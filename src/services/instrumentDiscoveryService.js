class InstrumentDiscoveryService {
  constructor({ iolHttpClient, logger }) {
    this.iolHttpClient = iolHttpClient;
    this.logger = logger;
  }

  async getInstrumentSymbols(instrumentDefinition, options) {
    const { pais, panel, pageSize, maxPages } = options;
    const { items, source } = await this.fetchDiscoverySnapshot(instrumentDefinition, {
      pais,
      panel
    });

    const unique = new Map();
    const extracted = this.extractSymbolRecords(items, instrumentDefinition.key);
    const maxItems = Math.max(1, Number(pageSize) * Math.max(1, Number(maxPages)));

    for (const record of extracted.slice(0, maxItems)) {
      if (!unique.has(record.simbolo)) {
        unique.set(record.simbolo, record);
      }
    }

    this.logger.info(
      `Descubrimiento ${instrumentDefinition.key}: ${unique.size} simbolos (${source || "sin fuente"})`
    );

    return {
      symbols: Array.from(unique.values()),
      sources: source ? [source] : []
    };
  }

  async fetchDiscoverySnapshot(instrumentDefinition, { pais, panel }) {
    const endpointCandidates = buildDiscoveryCandidates(instrumentDefinition.apiInstrument, pais, panel);

    const failures = [];
    for (const endpoint of endpointCandidates) {
      try {
        const payload = await this.iolHttpClient.get(endpoint);
        const items = extractListPayload(payload);
        return { items, source: endpoint };
      } catch (error) {
        failures.push(`${endpoint}: ${error.message}`);
      }
    }

    throw new Error(
      `No se pudo descubrir simbolos para ${instrumentDefinition.key}. Detalles: ${failures.join(" | ")}`
    );
  }

  extractSymbolRecords(items, instrumentKey) {
    return items
      .map((item) => {
        const symbol = pickAny(item, [
          "simbolo",
          "simboloPizarra",
          "ticker",
          "codigo",
          "titulo.simbolo",
          "idTitulo"
        ]);

        if (!symbol) {
          return null;
        }

        return {
          instrumento: instrumentKey,
          simbolo: String(symbol).trim().toUpperCase(),
          descripcion: pickAny(item, ["descripcion", "titulo.descripcion", "denominacion", "nombre"]) || null,
          mercado: pickAny(item, ["mercado", "plazo", "mercadoNombre"]) || null,
          panel: pickAny(item, ["panel", "sector", "grupo"]) || null
        };
      })
      .filter(Boolean);
  }
}

function buildDiscoveryCandidates(apiInstrument, pais, panel) {
  const safeInstrument = encodeURIComponent(apiInstrument);
  const safePais = encodeURIComponent(pais);
  const safePanel = encodeURIComponent(panel || "general");

  return [
    `/Cotizaciones/${safeInstrument}/${safePanel}/${safePais}`,
    `/Cotizaciones/${safeInstrument}/${safePais}/Todos`
  ];
}

function extractListPayload(payload) {
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
    payload.titulos,
    payload.cotizaciones,
    payload.resultado,
    payload.resultado && payload.resultado.items,
    payload.result,
    payload.activos
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function pickAny(objectValue, paths) {
  for (const path of paths) {
    const found = getPathValue(objectValue, path);
    if (found !== undefined && found !== null && found !== "") {
      return found;
    }
  }
  return null;
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
  InstrumentDiscoveryService
};
