const fs = require("node:fs");
const path = require("node:path");
const { INSTRUMENT_DEFINITIONS, DEFAULTS } = require("../config/constants");

const DEFAULT_CACHE_PATH = path.join("data", "symbols.json");
// Bundled into the packaged .exe as a pkg asset (see package.json's "pkg.assets"),
// so a fresh install has a working symbol list without shipping a second file -
// seeded out to real disk on first run, then updated normally from there on.
const SEED_CACHE_PATH = path.join(__dirname, "..", "..", "data", "symbols.json");

class SymbolCacheService {
  constructor({ authService, discoveryService, cachePath, logger }) {
    this.authService = authService;
    this.discoveryService = discoveryService;
    this.cachePath = cachePath || DEFAULT_CACHE_PATH;
    this.logger = logger;
  }

  async refreshSymbolCache(options = {}) {
    const pais = options.pais || DEFAULTS.pais;
    const panel = options.panel || DEFAULTS.panel;
    const pageSize = options.pageSize || DEFAULTS.pageSize;
    const maxPages = options.maxPages || DEFAULTS.maxPages;

    await this.authService.getAccessToken();

    const categories = {};
    for (const definition of INSTRUMENT_DEFINITIONS) {
      const { symbols } = await this.discoveryService.getInstrumentSymbols(definition, {
        pais,
        panel,
        pageSize,
        maxPages
      });

      categories[definition.key] = symbols.map((record) => ({
        simbolo: record.simbolo,
        descripcion: record.descripcion
      }));

      this.logger.info(`Caché de símbolos actualizado (${definition.key}): ${symbols.length} símbolos`);
    }

    const cache = {
      generatedAt: new Date().toISOString(),
      categories
    };

    this.writeCache(cache);

    return cache;
  }

  writeCache(cache) {
    fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
    fs.writeFileSync(this.cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  }

  readCache() {
    if (!fs.existsSync(this.cachePath)) {
      this.seedCacheFromBundledCopy();
    }
    if (!fs.existsSync(this.cachePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
  }

  seedCacheFromBundledCopy() {
    // Only relevant inside the packaged .exe (pkg sets process.pkg) - a normal
    // `node src/appRunner.js` checkout already has data/symbols.json at the
    // default relative path, so this never needs to fire there.
    if (!process.pkg) {
      return;
    }
    try {
      if (!fs.existsSync(SEED_CACHE_PATH)) {
        return;
      }
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.copyFileSync(SEED_CACHE_PATH, this.cachePath);
    } catch {
      // Best-effort: if the bundled seed can't be read/copied, readCache() falls through to null.
    }
  }
}

module.exports = {
  SymbolCacheService,
  DEFAULT_CACHE_PATH
};
