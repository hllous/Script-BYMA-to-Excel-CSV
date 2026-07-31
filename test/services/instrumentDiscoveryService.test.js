const { test } = require("node:test");
const assert = require("node:assert/strict");
const { InstrumentDiscoveryService } = require("../../src/services/instrumentDiscoveryService");

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

const ACCIONES = { key: "acciones", displayName: "Acciones", apiInstrument: "Acciones", supportsMep: false };

function makeFakeHttpClient(handler) {
  const calls = [];
  return {
    calls,
    get: async (url) => {
      calls.push(url);
      return handler(url);
    }
  };
}

test("getInstrumentSymbols extracts symbols from the first endpoint candidate that succeeds", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/Cotizaciones/Acciones/general/argentina") {
      return [{ simbolo: "ggal", descripcion: "Grupo Galicia" }];
    }
    throw new Error("should not reach fallback endpoint");
  });

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 100,
    maxPages: 200
  });

  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].simbolo, "GGAL");
  assert.equal(result.symbols[0].instrumento, "acciones");
  assert.equal(result.symbols[0].descripcion, "Grupo Galicia");
});

test("getInstrumentSymbols falls back to the second endpoint candidate when the first fails", async () => {
  const iolHttpClient = makeFakeHttpClient((url) => {
    if (url === "/Cotizaciones/Acciones/general/argentina") {
      throw new Error("500");
    }
    if (url === "/Cotizaciones/Acciones/argentina/Todos") {
      return [{ simbolo: "pamp" }];
    }
    throw new Error("unexpected endpoint");
  });

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 100,
    maxPages: 200
  });

  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].simbolo, "PAMP");
});

test("getInstrumentSymbols throws a combined error when every endpoint candidate fails", async () => {
  const iolHttpClient = makeFakeHttpClient(() => {
    throw new Error("boom");
  });

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });

  await assert.rejects(
    () => service.getInstrumentSymbols(ACCIONES, { pais: "argentina", panel: "general", pageSize: 100, maxPages: 200 }),
    /No se pudo descubrir símbolos para acciones/
  );
});

test("getInstrumentSymbols de-duplicates repeated symbols, keeping the first occurrence", async () => {
  const iolHttpClient = makeFakeHttpClient(() => [
    { simbolo: "ggal", descripcion: "primera" },
    { simbolo: "GGAL", descripcion: "segunda" }
  ]);

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 100,
    maxPages: 200
  });

  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].descripcion, "primera");
});

test("getInstrumentSymbols extracts the list from wrapped response shapes (data/items/resultado.items)", async () => {
  const iolHttpClient = makeFakeHttpClient(() => ({ resultado: { items: [{ ticker: "AL30" }] } }));

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 100,
    maxPages: 200
  });

  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].simbolo, "AL30");
});

test("getInstrumentSymbols caps results at pageSize * maxPages", async () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ simbolo: `SYM${i}` }));
  const iolHttpClient = makeFakeHttpClient(() => items);

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 2,
    maxPages: 2
  });

  assert.equal(result.symbols.length, 4);
});

test("getInstrumentSymbols skips items with no resolvable symbol field", async () => {
  const iolHttpClient = makeFakeHttpClient(() => [{ descripcion: "sin simbolo" }, { simbolo: "GGAL" }]);

  const service = new InstrumentDiscoveryService({ iolHttpClient, logger: makeLogger() });
  const result = await service.getInstrumentSymbols(ACCIONES, {
    pais: "argentina",
    panel: "general",
    pageSize: 100,
    maxPages: 200
  });

  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].simbolo, "GGAL");
});
