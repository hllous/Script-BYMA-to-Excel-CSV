const { test } = require("node:test");
const assert = require("node:assert/strict");
const { QuoteAggregationService } = require("../../src/services/quoteAggregationService");

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

const BONOS = { key: "bonos", displayName: "Bonos", apiInstrument: "TitulosPublicos", supportsMep: true };
const ACCIONES = { key: "acciones", displayName: "Acciones", apiInstrument: "Acciones", supportsMep: false };

function makeFakeHttpClient(handler) {
  return { get: async (url, options) => handler(url, options) };
}

function symbolRecord(overrides = {}) {
  return { instrumento: "acciones", simbolo: "GGAL", descripcion: "Grupo Galicia", mercado: "1", panel: "general", ...overrides };
}

test("aggregateInstrumentQuotes builds a normalized row from the first successful quote-detail endpoint", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/1/Titulos/GGAL/CotizacionDetalle") {
      return {
        ultimoPrecio: 1500.5,
        apertura: 1490,
        volumen: 1000,
        rango52SemanasMin: 1000,
        rango52SemanasMax: 2000,
        fechaHoraCotizacion: "2026-07-30T15:00:00.000Z"
      };
    }
    throw new Error("unexpected endpoint");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord()], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  assert.equal(result.failures.length, 0);
  assert.equal(result.records.length, 1);
  const [row] = result.records;
  assert.equal(row.instrumento, "acciones");
  assert.equal(row.simbolo, "GGAL");
  assert.equal(row.ultimoPrecio, 1500.5);
  assert.equal(row.rango52SemanasMin, 1000);
  assert.equal(row.rango52SemanasMax, 2000);
  assert.equal(row.mepCclImplicito, null);
});

test("aggregateInstrumentQuotes falls back to montoOperado for volumen when volumenNominal is 0 (real IOL API quirk)", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/1/Titulos/GGAL/CotizacionDetalle") {
      return {
        ultimoPrecio: 1500.5,
        volumenNominal: 0,
        montoOperado: 411893042,
        fechaHoraCotizacion: "2026-07-30T15:00:00.000Z"
      };
    }
    throw new Error("unexpected endpoint");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord()], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].volumen, 411893042);
});

test("aggregateInstrumentQuotes records a failure (not a thrown error) when every quote-detail endpoint fails", async () => {
  const iolHttpClient = makeFakeHttpClient(() => {
    throw new Error("500");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord()], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  assert.equal(result.records.length, 0);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].simbolo, "GGAL");
  assert.equal(result.failures[0].instrumento, "acciones");
});

test("aggregateInstrumentQuotes rejects symbols containing unsafe characters without calling the API", async () => {
  let called = false;
  const iolHttpClient = makeFakeHttpClient(() => {
    called = true;
    return {};
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord({ simbolo: "GG AL/1" })], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  assert.equal(called, false);
  assert.equal(result.records.length, 0);
  assert.match(result.failures[0].error, /no soportado/);
});

test("aggregateInstrumentQuotes falls back to the historical-range endpoint when the quote detail lacks a 52-week range", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/1/Titulos/GGAL/CotizacionDetalle") {
      return { ultimoPrecio: 1500 };
    }
    if (url.includes("/seriehistorica/")) {
      return [{ minimo: 900 }, { maximo: 2200 }];
    }
    throw new Error("unexpected endpoint");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord()], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  const [row] = result.records;
  assert.equal(row.rango52SemanasMin, 900);
  assert.equal(row.rango52SemanasMax, 2200);
});

test("aggregateInstrumentQuotes only looks up MEP/CCL for instrument definitions with supportsMep: true", async () => {
  let mepCalled = false;
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url.includes("CotizacionDetalle")) {
      return { ultimoPrecio: 1000, rango52SemanasMin: 1, rango52SemanasMax: 2 };
    }
    if (url.toLowerCase().includes("/mep/")) {
      mepCalled = true;
      return { mep: 1234 };
    }
    throw new Error("unexpected endpoint");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  await service.aggregateInstrumentQuotes(ACCIONES, [symbolRecord()], { pais: "argentina", panel: "general", concurrency: 2 });

  assert.equal(mepCalled, false);
});

test("aggregateInstrumentQuotes fetches and attaches mepCclImplicito for instruments where supportsMep is true", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url.includes("CotizacionDetalle")) {
      return { ultimoPrecio: 1000, rango52SemanasMin: 1, rango52SemanasMax: 2 };
    }
    if (url.toLowerCase().includes("/mep/")) {
      return { mep: 1234 };
    }
    throw new Error("unexpected endpoint");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(BONOS, [symbolRecord({ instrumento: "bonos", simbolo: "AL30" })], {
    pais: "argentina",
    panel: "general",
    concurrency: 2
  });

  assert.equal(result.records[0].mepCclImplicito, 1234);
});

test("aggregateInstrumentQuotes processes multiple symbols and preserves per-symbol pass/fail outcomes", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/1/Titulos/GOOD/CotizacionDetalle") {
      return { ultimoPrecio: 100, rango52SemanasMin: 1, rango52SemanasMax: 2 };
    }
    throw new Error("500");
  });

  const service = new QuoteAggregationService({ iolHttpClient, logger: makeLogger() });
  const result = await service.aggregateInstrumentQuotes(
    ACCIONES,
    [symbolRecord({ simbolo: "GOOD" }), symbolRecord({ simbolo: "BAD" })],
    { pais: "argentina", panel: "general", concurrency: 2 }
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].simbolo, "GOOD");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].simbolo, "BAD");
});
