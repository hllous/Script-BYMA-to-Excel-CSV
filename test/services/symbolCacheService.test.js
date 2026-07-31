const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { SymbolCacheService } = require("../../src/services/symbolCacheService");
const { INSTRUMENT_DEFINITIONS } = require("../../src/config/constants");

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function makeCachePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "symbolCacheService-test-"));
  return path.join(dir, "symbols.json");
}

function makeFakeAuthService() {
  const calls = [];
  return {
    calls,
    getAccessToken: async () => {
      calls.push("getAccessToken");
      return "fake-token";
    }
  };
}

function makeFakeDiscoveryService() {
  const calls = [];
  return {
    calls,
    getInstrumentSymbols: async (definition) => {
      calls.push(definition.key);
      return {
        symbols: [
          { simbolo: `${definition.key.toUpperCase()}1`, descripcion: `desc ${definition.key}` }
        ],
        sources: []
      };
    }
  };
}

test("refreshSymbolCache logs in before discovering symbols", async () => {
  const authService = makeFakeAuthService();
  const discoveryService = makeFakeDiscoveryService();
  const cachePath = makeCachePath();

  const service = new SymbolCacheService({ authService, discoveryService, cachePath, logger: makeLogger() });
  await service.refreshSymbolCache();

  assert.deepEqual(authService.calls, ["getAccessToken"]);
});

test("refreshSymbolCache discovers every instrument category", async () => {
  const authService = makeFakeAuthService();
  const discoveryService = makeFakeDiscoveryService();
  const cachePath = makeCachePath();

  const service = new SymbolCacheService({ authService, discoveryService, cachePath, logger: makeLogger() });
  await service.refreshSymbolCache();

  assert.deepEqual(discoveryService.calls, INSTRUMENT_DEFINITIONS.map((item) => item.key));
});

test("refreshSymbolCache writes a cache file keyed by category with simbolo/descripcion pairs", async () => {
  const authService = makeFakeAuthService();
  const discoveryService = makeFakeDiscoveryService();
  const cachePath = makeCachePath();

  const service = new SymbolCacheService({ authService, discoveryService, cachePath, logger: makeLogger() });
  await service.refreshSymbolCache();

  const written = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  assert.ok(written.generatedAt);
  assert.equal(Object.keys(written.categories).length, INSTRUMENT_DEFINITIONS.length);
  assert.deepEqual(written.categories.acciones, [{ simbolo: "ACCIONES1", descripcion: "desc acciones" }]);
});

test("refreshSymbolCache overwrites an existing cache file", async () => {
  const authService = makeFakeAuthService();
  const discoveryService = makeFakeDiscoveryService();
  const cachePath = makeCachePath();
  fs.writeFileSync(cachePath, JSON.stringify({ generatedAt: "stale", categories: {} }), "utf8");

  const service = new SymbolCacheService({ authService, discoveryService, cachePath, logger: makeLogger() });
  await service.refreshSymbolCache();

  const written = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  assert.notEqual(written.generatedAt, "stale");
  assert.equal(Object.keys(written.categories).length, INSTRUMENT_DEFINITIONS.length);
});

test("readCache returns null when the cache file does not exist", () => {
  const cachePath = makeCachePath();
  const service = new SymbolCacheService({
    authService: makeFakeAuthService(),
    discoveryService: makeFakeDiscoveryService(),
    cachePath,
    logger: makeLogger()
  });

  assert.equal(service.readCache(), null);
});

test("readCache returns the parsed cache file when it exists", async () => {
  const authService = makeFakeAuthService();
  const discoveryService = makeFakeDiscoveryService();
  const cachePath = makeCachePath();

  const service = new SymbolCacheService({ authService, discoveryService, cachePath, logger: makeLogger() });
  await service.refreshSymbolCache();

  const cache = service.readCache();
  assert.equal(Object.keys(cache.categories).length, INSTRUMENT_DEFINITIONS.length);
});
