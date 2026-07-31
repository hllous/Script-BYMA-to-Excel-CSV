const { buildNormalizedQuote } = require("../models/quoteSchema");
const { runWithConcurrency } = require("../utils/asyncPool");

class QuoteAggregationService {
  constructor({ iolHttpClient, logger }) {
    this.iolHttpClient = iolHttpClient;
    this.logger = logger;
  }

  async aggregateInstrumentQuotes(instrumentDefinition, symbolRecords, options) {
    const failures = [];
    const total = symbolRecords.length;
    let processed = 0;
    let lastLogged = 0;

    const rows = await runWithConcurrency(symbolRecords, options.concurrency, async (symbolRecord) => {
      try {
        if (!isApiSymbolSafe(symbolRecord.simbolo)) {
          const errorText = `Símbolo no soportado por endpoint detalle: ${symbolRecord.simbolo}`;
          failures.push({
            instrumento: instrumentDefinition.key,
            simbolo: symbolRecord.simbolo,
            error: errorText
          });
          this.logger.warn(`Fallo símbolo ${symbolRecord.simbolo} (${instrumentDefinition.key}): ${errorText}`);
          return null;
        }

        return await this.aggregateSingleQuote(instrumentDefinition, symbolRecord, options);
      } catch (error) {
        const failure = {
          instrumento: instrumentDefinition.key,
          simbolo: symbolRecord.simbolo,
          error: error.message
        };
        failures.push(failure);
        this.logger.warn(
          `Fallo símbolo ${symbolRecord.simbolo} (${instrumentDefinition.key}): ${error.message}`
        );
        return null;
      } finally {
        processed += 1;
        if (shouldLogProgress(processed, total, lastLogged)) {
          lastLogged = processed;
          const pct = Math.round((processed / total) * 100);
          this.logger.info(`Cargando ${instrumentDefinition.key}: ${processed}/${total} (${pct}%)`);
          if (typeof options.onProgress === "function") {
            options.onProgress({ key: instrumentDefinition.key, processed, total, pct });
          }
        }
      }
    });

    return {
      records: rows.filter(Boolean),
      failures
    };
  }

  async aggregateSingleQuote(instrumentDefinition, symbolRecord, options) {
    const sourceTrace = [];

    const quoteResult = await this.fetchQuoteDetail(symbolRecord, options);
    sourceTrace.push(quoteResult.source);

    const quotePayload = normalizeQuotePayload(quoteResult.payload);
    const rangeFromQuote = extractRangeFromQuote(quotePayload);

    let range52 = {
      min: rangeFromQuote.min,
      max: rangeFromQuote.max
    };

    if (range52.min === null || range52.max === null) {
      const historicalRange = await this.fetchHistoricalRange(
        instrumentDefinition,
        symbolRecord.simbolo,
        { ...options, mercado: symbolRecord.mercado }
      ).catch(() => null);

      if (historicalRange) {
        range52 = {
          min: range52.min ?? historicalRange.min,
          max: range52.max ?? historicalRange.max
        };
        sourceTrace.push(historicalRange.source);
      }
    }

    let mepCclImplicito = null;
    if (instrumentDefinition.supportsMep) {
      const mepResult = await this.fetchMepCclImplicito(symbolRecord.simbolo, options).catch(() => null);
      if (mepResult) {
        mepCclImplicito = mepResult.value;
        sourceTrace.push(mepResult.source);
      }
    }

    return buildNormalizedQuote({
      instrumento: instrumentDefinition.key,
      simbolo: symbolRecord.simbolo,
      descripcion: pickAny(quotePayload, ["descripcion", "titulo.descripcion", "denominacion"]) || symbolRecord.descripcion,
      mercado: pickAny(quotePayload, ["mercado", "mercadoNombre", "plazo"]) || symbolRecord.mercado,
      panel: pickAny(quotePayload, ["panel", "sector", "grupo"]) || symbolRecord.panel,
      ultimoPrecio: pickNumber(quotePayload, ["ultimoPrecio", "ultimo", "precioUltimo", "precio", "ultimoOperado"]),
      apertura: pickNumber(quotePayload, ["apertura", "precioApertura"]),
      cierreAnterior: pickNumber(quotePayload, ["cierreAnterior", "precioCierreAnterior"]),
      variacionDiaria: pickNumber(quotePayload, ["variacionDiaria", "variacion", "variacionPorcentual"]),
      // The IOL API's volumenNominal/volumenOperado fields report 0 for most
      // instruments (a known upstream API quirk); montoOperado (traded amount
      // in ARS) is the field that actually carries real data, so it takes
      // priority.
      volumen: pickNumber(quotePayload, ["montoOperado", "volumen", "volumenNominal", "volumenOperado"]),
      maximo: pickNumber(quotePayload, ["maximo", "precioMaximo", "high"]),
      minimo: pickNumber(quotePayload, ["minimo", "precioMinimo", "low"]),
      rango52SemanasMin: range52.min,
      rango52SemanasMax: range52.max,
      fechaHoraCotizacion: pickAny(quotePayload, [
        "fechaHoraCotizacion",
        "fechaHora",
        "fecha",
        "ultimoCierre.fechaHora"
      ]),
      mepCclImplicito,
      fuente: sourceTrace.filter(Boolean).join(";") || null
    });
  }

  async fetchQuoteDetail(symbolRecord) {
    const endpointCandidates = buildQuoteDetailCandidates(symbolRecord);

    const failures = [];
    for (const endpoint of endpointCandidates) {
      try {
        const payload = await this.iolHttpClient.get(endpoint);
        return { payload, source: endpoint };
      } catch (error) {
        failures.push(`${endpoint}: ${error.message}`);
      }
    }

    throw new Error(
      `No se pudo obtener cotización detalle para ${symbolRecord.simbolo}. Detalles: ${failures.join(" | ")}`
    );
  }

  async fetchMepCclImplicito(symbol, options) {
    const endpointCandidates = [
      `/Cotizaciones/MEP/${encodeURIComponent(symbol)}`,
      `/cotizaciones/mep/${encodeURIComponent(symbol)}`
    ];

    const params = {
      pais: options.pais,
      simbolo: symbol
    };

    for (const endpoint of endpointCandidates) {
      try {
        const payload = await this.iolHttpClient.get(endpoint, { params });
        const value = pickNumber(payload, [
          "mepCclImplicito",
          "mep",
          "ccl",
          "precioCompra",
          "precioVenta",
          "precio",
          "valor",
          "venta",
          "ultimoPrecio",
          "cotizacion"
        ]);

        if (value !== null) {
          return { value, source: endpoint };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  async fetchHistoricalRange(instrumentDefinition, symbol, options) {
    const { fromDate, toDate } = getLast52WeeksRange();
    const endpointCandidates = buildHistoricalCandidates(options.mercado, symbol, fromDate, toDate);

    for (const endpoint of endpointCandidates) {
      try {
        const payload = await this.iolHttpClient.get(endpoint);
        const bars = extractSeriesPayload(payload);
        if (!bars.length) {
          continue;
        }

        const min = getArrayExtreme(bars, "min");
        const max = getArrayExtreme(bars, "max");

        if (min !== null || max !== null) {
          return { min, max, source: endpoint };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }
}

function shouldLogProgress(processed, total, lastLogged) {
  if (processed === total) {
    return true;
  }

  const step = Math.max(10, Math.ceil(total / 20));
  return processed - lastLogged >= step;
}

function isApiSymbolSafe(symbol) {
  return /^[A-Za-z0-9.\-]+$/.test(String(symbol || ""));
}

function buildQuoteDetailCandidates(symbolRecord) {
  const symbol = symbolRecord.simbolo;
  const safe = encodeURIComponent(symbol);
  const marketCandidates = [];

  if (symbolRecord.mercado !== undefined && symbolRecord.mercado !== null && String(symbolRecord.mercado).trim() !== "") {
    marketCandidates.push(String(symbolRecord.mercado).trim());
  }
  marketCandidates.push("1", "3");

  const unique = new Set();
  for (const market of marketCandidates) {
    const safeMarket = encodeURIComponent(market);
    unique.add(`/${safeMarket}/Titulos/${safe}/CotizacionDetalle`);
    unique.add(`/${safeMarket}/Titulos/${safe}/Cotizacion`);
  }

  return Array.from(unique);
}

function buildHistoricalCandidates(mercado, symbol, fromDate, toDate) {
  const safe = encodeURIComponent(symbol);
  const marketCandidates = [];

  if (mercado !== undefined && mercado !== null && String(mercado).trim() !== "") {
    marketCandidates.push(String(mercado).trim());
  }
  marketCandidates.push("1", "3");

  const unique = new Set();

  for (const market of marketCandidates) {
    const safeMarket = encodeURIComponent(market);
    unique.add(`/${safeMarket}/Titulos/${safe}/Cotizacion/seriehistorica/${fromDate}/${toDate}/0`);
  }

  return Array.from(unique);
}

function normalizeQuotePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  if (payload.cotizacion && typeof payload.cotizacion === "object") {
    return { ...payload, ...payload.cotizacion };
  }

  return payload;
}

function extractRangeFromQuote(payload) {
  return {
    min: pickNumber(payload, [
      "rango52SemanasMin",
      "minimo52Semanas",
      "minimo52semanas",
      "min52Semanas",
      "minimoAnual"
    ]),
    max: pickNumber(payload, [
      "rango52SemanasMax",
      "maximo52Semanas",
      "maximo52semanas",
      "max52Semanas",
      "maximoAnual"
    ])
  };
}

function extractSeriesPayload(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.items,
    payload.data,
    payload.content,
    payload.historicos,
    payload.resultado,
    payload.resultado && payload.resultado.items,
    payload.serieHistorica,
    payload.cotizaciones
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function getArrayExtreme(items, type) {
  const values = items
    .map((item) =>
      pickNumber(
        item,
        type === "min"
          ? ["minimo", "precioMinimo", "low", "ultimoPrecio", "cierre"]
          : ["maximo", "precioMaximo", "high", "ultimoPrecio", "cierre"]
      )
    )
    .filter((value) => value !== null);

  if (!values.length) {
    return null;
  }

  return type === "min" ? Math.min(...values) : Math.max(...values);
}

function getLast52WeeksRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
  return {
    fromDate: toIsoDate(from),
    toDate: toIsoDate(to)
  };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function pickAny(objectValue, paths) {
  for (const path of paths) {
    const value = getPathValue(objectValue, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function pickNumber(objectValue, paths) {
  const raw = pickAny(objectValue, paths);
  if (raw === null) {
    return null;
  }

  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function getPathValue(objectValue, path) {
  if (!objectValue || !path) {
    return undefined;
  }

  return path.split(".").reduce((current, segment) => {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      return current[segment];
    }
    return undefined;
  }, objectValue);
}

module.exports = {
  QuoteAggregationService
};
