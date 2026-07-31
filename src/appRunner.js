const path = require("node:path");
const { parseArgs, printHelp } = require("./utils/argParser");
const { promptForCredentials, promptToSaveToVault } = require("./utils/prompt");
const {
  promptForOutputFormat,
  promptForSymbolSelectionWithReuse,
  promptForInstrumentSelection,
  promptForPostRunAction,
  BACK_CHOICE
} = require("./interactiveMenu");
const { loadLocalConfig } = require("./utils/configLoader");
const { Logger } = require("./utils/logger");
const { getDateInArgentina, formatDateInArgentina } = require("./utils/dateFormat");
const { printHomeBanner } = require("./utils/banner");
const { renderProgressBar } = require("./utils/progressBar");
const { DEFAULTS, INSTRUMENT_DEFINITIONS } = require("./config/constants");
const { AuthService } = require("./services/authService");
const { IolHttpClient } = require("./services/iolHttpClient");
const { InstrumentDiscoveryService } = require("./services/instrumentDiscoveryService");
const { QuoteAggregationService } = require("./services/quoteAggregationService");
const { ExportService } = require("./services/exportService");
const { CredentialVaultService } = require("./services/credentialVaultService");
const { SymbolCacheService } = require("./services/symbolCacheService");
const { LastSelectionService } = require("./services/lastSelectionService");

async function main() {
  const cliOptions = parseArgs(process.argv);
  if (cliOptions.help) {
    printHelp();
    return;
  }

  const localConfig = loadLocalConfig(path.resolve(process.cwd(), "config.local.json"));
  const options = mergeOptions(cliOptions, localConfig);
  const vaultService = new CredentialVaultService();

  const useInteractiveMenu = shouldUseInteractiveMenu(options, cliOptions);
  const symbolCacheService = useInteractiveMenu ? new SymbolCacheService({}) : null;
  const lastSelectionService = useInteractiveMenu ? new LastSelectionService({}) : null;

  let keepRunning = true;
  // Only the very first instrument selection of this process may offer to reuse
  // whatever was saved from a genuinely previous session/process. Every later
  // pass through this loop - whether from "Volver al menu" after a run, or from
  // backing out of the format step - starts the picker blank instead, since the
  // "last selection" at that point is just what was picked a moment ago in this
  // same session, not a stale prior-session value worth asking about again.
  let hasPromptedThisSession = false;

  while (keepRunning) {
    keepRunning = false;

    let instrumentTargets;

    if (useInteractiveMenu) {
      printHomeBanner();

      let selection;
      let formatoToken;

      // Lets the user bounce back and forth between instrument selection and
      // the format step (via "Volver a seleccionar instrumentos") before the
      // run actually starts.
      for (;;) {
        const cache = symbolCacheService.readCache();
        if (!cache) {
          throw new Error(
            "No hay caché de símbolos (data/symbols.json). Restaure el archivo del repositorio o actualice la lista desde IOL."
          );
        }

        if (!hasPromptedThisSession) {
          selection = await promptForSymbolSelectionWithReuse({
            cache,
            lastSelectionService,
            onUpdateSymbolList: () => refreshSymbolCacheInteractively(options, vaultService)
          });
          hasPromptedThisSession = true;
        } else {
          selection = await promptForInstrumentSelection({
            cache,
            onUpdateSymbolList: () => refreshSymbolCacheInteractively(options, vaultService)
          });
          // Saved immediately (not deferred to process exit) so that whatever
          // was last picked in this session is what a future run offers to
          // reuse - promptForSymbolSelectionWithReuse already does this same
          // write for the first-ever selection above.
          lastSelectionService.writeSelection(selection);
        }

        formatoToken = await promptForOutputFormat({ allowBack: true });
        if (formatoToken !== BACK_CHOICE) {
          break;
        }

        console.clear();
        printHomeBanner();
      }

      options.formatos = formatTokenToFormatos(formatoToken);

      const finalCache = symbolCacheService.readCache();
      instrumentTargets = buildInstrumentTargetsFromSelection(selection, finalCache);

      console.clear();
    } else {
      const selectedDefinitions = INSTRUMENT_DEFINITIONS.filter((definition) =>
        options.instrumentos.includes(definition.key)
      );
      instrumentTargets = selectedDefinitions.map((definition) => ({ definition, symbolRecords: null }));
    }

    if (instrumentTargets.length === 0) {
      throw new Error("La selección de instrumentos no contiene opciones válidas");
    }

    // Timing starts here, not at process launch: for the interactive menu, everything
    // above this point is the user browsing/searching/thinking, which isn't part of the
    // run's actual work and previously inflated "Duracion total" by however long the user
    // spent in the picker.
    const startedAt = new Date();
    const startedAtIso = startedAt.toISOString();

    const selectedDefinitions = instrumentTargets.map((target) => target.definition);
    const runId = buildRunId(selectedDefinitions.map((item) => item.key), startedAtIso);
    const outputDir = path.resolve(process.cwd(), options.salida || DEFAULTS.outputDir);
    const logger = new Logger(path.join(outputDir, `${runId}.log`));

    logger.info("Inicio de ejecución");
    logger.info(`Instrumentos solicitados: ${selectedDefinitions.map((item) => item.key).join(",")}`);

    const credentials = await resolveCredentials(options, vaultService);
    if (!credentials.username || !credentials.password) {
      throw new Error("No hay credenciales de IOL. Use args, variables de entorno o config.local.json");
    }
    // Persist whatever was resolved so a subsequent loop iteration (picking "Volver al
    // menu" after a run) doesn't prompt for credentials again.
    options.username = credentials.username;
    options.password = credentials.password;

    const { authService, iolHttpClient, discoveryService } = buildIolServices(options, credentials, logger);
    const aggregationService = new QuoteAggregationService({ iolHttpClient, logger });
    const exportService = new ExportService({ outputDir, logger });

    await authService.getAccessToken();

    const allRows = [];
    const allFailures = [];

    for (const target of instrumentTargets) {
      const { definition } = target;
      logger.info(`Procesando instrumento ${definition.key}...`);

      try {
        const symbolRecords =
          target.symbolRecords ||
          (
            await discoveryService.getInstrumentSymbols(definition, {
              pais: options.pais,
              panel: options.panel,
              pageSize: options.pageSize,
              maxPages: options.maxPages
            })
          ).symbols;

        if (!symbolRecords.length) {
          logger.warn(`No se encontraron símbolos para ${definition.key}`);
          continue;
        }

        renderProgressBar({ label: `Procesando ${definition.key}`, current: 0, total: symbolRecords.length });
        const aggregation = await aggregationService.aggregateInstrumentQuotes(definition, symbolRecords, {
          pais: options.pais,
          panel: options.panel,
          concurrency: options.concurrency,
          onProgress: ({ processed, total }) =>
            renderProgressBar({ label: `Procesando ${definition.key}`, current: processed, total })
        });

        allRows.push(...aggregation.records);
        allFailures.push(...aggregation.failures);

        logger.info(
          `Instrumento ${definition.key}: ok=${aggregation.records.length}, fallos=${aggregation.failures.length}`
        );
      } catch (error) {
        const failure = {
          instrumento: definition.key,
          simbolo: null,
          error: error.message
        };
        allFailures.push(failure);
        logger.error(`Instrumento ${definition.key} fallo: ${error.message}`);
      }
    }

    applyCalculatedImplicitCcl(allRows);

    const createdFiles = exportService.exportData(allRows, options.formatos, runId);

    const endedAt = new Date();
    const executionStats = buildExecutionStats(startedAt, endedAt, selectedDefinitions.length, allRows.length, allFailures.length);

    const audit = {
      runId,
      startedAt: startedAtIso,
      endedAt: endedAt.toISOString(),
      duracionMs: executionStats.durationMs,
      duracionTexto: executionStats.durationText,
      estadoMercado: executionStats.market.status,
      cierreMercadoEstimado: executionStats.market.closeAt,
      totalInstrumentos: selectedDefinitions.length,
      totalRegistros: allRows.length,
      totalFallos: allFailures.length,
      parametros: {
        instrumentos: options.instrumentos,
        pais: options.pais,
        panel: options.panel,
        formatos: options.formatos,
        pageSize: options.pageSize,
        maxPages: options.maxPages,
        concurrency: options.concurrency
      },
      fallos: allFailures
    };

    const auditPath = exportService.exportAudit(audit, runId);

    logger.info(`Archivos generados: ${[...createdFiles, auditPath].join(" | ")}`);
    logger.info("Ejecución finalizada");
    logger.info(`Duración total: ${executionStats.durationText}`);
    logger.info(`Mercado: ${executionStats.market.label}`);

    console.log("\n=== Estadísticas de corrida ===");
    console.log(`Inicio: ${formatDateInArgentina(startedAt)}`);
    console.log(`Fin: ${formatDateInArgentina(endedAt)}`);
    console.log(`Duración: ${executionStats.durationText}`);
    console.log(`Mercado: ${executionStats.market.label}`);
    console.log(`\nRegistros exportados: ${allRows.length}`);
    console.log(`Fallos: ${allFailures.length}`);

    if (allFailures.length > 0) {
      console.log("Símbolos con error:");
      for (const failure of allFailures) {
        console.log(`  - ${failure.simbolo || `(instrumento ${failure.instrumento} completo)`}: ${failure.error}`);
      }
    }

    if (useInteractiveMenu) {
      console.log("");
      const postRunAction = await promptForPostRunAction();
      if (postRunAction === "menu") {
        console.clear();
        keepRunning = true;
      }
    }
  }
}

function buildIolServices(options, credentials, logger) {
  const authService = new AuthService({
    username: credentials.username,
    password: credentials.password,
    authUrl: options.authUrl || DEFAULTS.authUrl,
    timeoutMs: options.timeoutMs,
    logger
  });

  const iolHttpClient = new IolHttpClient({
    authService,
    baseUrl: options.apiBaseUrl || DEFAULTS.apiBaseUrl,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    logger
  });

  const discoveryService = new InstrumentDiscoveryService({ iolHttpClient, logger });

  return { authService, iolHttpClient, discoveryService };
}

// Per spec: the searchable symbol picker + last-selection reuse + format step only take
// over when nothing was already decided via CLI flags (used by run.bat's :RUN_DIRECT
// passthrough and by scripted/headless invocations).
function shouldUseInteractiveMenu(options, cliOptions) {
  return Boolean(options.interactive) && cliOptions.instrumentos === null && cliOptions.formatos === null;
}

function formatTokenToFormatos(formatoToken) {
  if (formatoToken === "csv") return ["csv"];
  if (formatoToken === "xlsx") return ["xlsx"];
  return [...DEFAULTS.formatos];
}

function buildInstrumentTargetsFromSelection(selection, cache) {
  const plan = new Map();

  for (const key of selection.categories) {
    const definition = INSTRUMENT_DEFINITIONS.find((item) => item.key === key);
    if (!definition) continue;

    const symbolRecords = (cache.categories[key] || []).map((symbol) => ({
      simbolo: symbol.simbolo,
      descripcion: symbol.descripcion,
      mercado: null,
      panel: null
    }));
    plan.set(key, { definition, symbolRecords });
  }

  for (const { category, simbolo } of selection.symbols) {
    const definition = INSTRUMENT_DEFINITIONS.find((item) => item.key === category);
    if (!definition) continue;

    if (!plan.has(category)) {
      plan.set(category, { definition, symbolRecords: [] });
    }

    const cacheEntry = (cache.categories[category] || []).find((symbol) => symbol.simbolo === simbolo);
    plan.get(category).symbolRecords.push({
      simbolo,
      descripcion: cacheEntry ? cacheEntry.descripcion : null,
      mercado: null,
      panel: null
    });
  }

  return Array.from(plan.values());
}

// Triggered from within the picker's "Update symbol list from IOL" action. Resolves its
// own credentials/login/discovery rather than reusing the main run's (not yet resolved
// at this point in the flow) so the picker can refresh mid-selection. Mutates `options`
// with whatever credentials it resolves so the main resolveCredentials() call right
// after the picker doesn't prompt the user a second time.
async function refreshSymbolCacheInteractively(options, vaultService) {
  const outputDir = path.resolve(process.cwd(), options.salida || DEFAULTS.outputDir);
  const logger = new Logger(path.join(outputDir, "symbol-cache-update.log"));

  const credentials = await resolveCredentials(options, vaultService);
  if (!credentials.username || !credentials.password) {
    throw new Error("No hay credenciales de IOL para actualizar la lista de símbolos.");
  }
  options.username = credentials.username;
  options.password = credentials.password;

  const { authService, discoveryService } = buildIolServices(options, credentials, logger);
  const symbolCacheService = new SymbolCacheService({ authService, discoveryService, logger });

  return symbolCacheService.refreshSymbolCache({
    pais: options.pais,
    panel: options.panel,
    pageSize: options.pageSize,
    maxPages: options.maxPages
  });
}

function mergeOptions(cliOptions, localConfig) {
  const config = localConfig || {};
  const defaultInstruments = INSTRUMENT_DEFINITIONS.map((item) => item.key);

  return {
    ...cliOptions,
    username: firstDefined(cliOptions.username, config.username, null),
    password: firstDefined(cliOptions.password, config.password, null),
    apiBaseUrl: config.apiBaseUrl || DEFAULTS.apiBaseUrl,
    authUrl: config.authUrl || DEFAULTS.authUrl,
    pais: firstDefined(cliOptions.pais, config.pais, DEFAULTS.pais),
    panel: firstDefined(cliOptions.panel, config.panel, DEFAULTS.panel),
    formatos: firstDefinedArray(cliOptions.formatos, config.formatos, DEFAULTS.formatos),
    salida: firstDefined(cliOptions.salida, config.salida, DEFAULTS.outputDir),
    pageSize: firstDefined(cliOptions.pageSize, config.pageSize, DEFAULTS.pageSize),
    maxPages: firstDefined(cliOptions.maxPages, config.maxPages, DEFAULTS.maxPages),
    concurrency: firstDefined(cliOptions.concurrency, config.concurrency, DEFAULTS.concurrency),
    timeoutMs: firstDefined(cliOptions.timeoutMs, config.timeoutMs, DEFAULTS.timeoutMs),
    retries: firstDefined(cliOptions.retries, config.retries, DEFAULTS.retries),
    instrumentos: firstDefinedArray(cliOptions.instrumentos, config.instrumentos, defaultInstruments),
    interactive: firstDefined(cliOptions.interactive, config.interactive, true)
  };
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function firstDefinedArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return [];
}

function buildRunId(instrumentKeys, startedAtIso) {
  const allKeys = INSTRUMENT_DEFINITIONS.map((item) => item.key);
  const sorted = [...new Set(instrumentKeys)].sort();
  const isAll = allKeys.length === sorted.length && allKeys.every((key) => sorted.includes(key));
  const instrumentToken = isAll ? "all" : sorted.join("-");
  const safeToken = instrumentToken.replace(/[^a-zA-Z0-9\-]/g, "-").slice(0, 80);
  return `byma-${safeToken}-${startedAtIso.replace(/[:.]/g, "-")}`;
}

function applyCalculatedImplicitCcl(records) {
  const families = new Map();

  for (const row of records) {
    const symbolInfo = parseSymbolFamily(row.simbolo);
    if (!symbolInfo || row.ultimoPrecio === null || row.ultimoPrecio === undefined) {
      continue;
    }

    const familyKey = `${row.instrumento || ""}:${symbolInfo.base}`;
    if (!families.has(familyKey)) {
      families.set(familyKey, {
        ars: null,
        usd: null,
        members: []
      });
    }

    const family = families.get(familyKey);
    family.members.push(row);
    if (symbolInfo.type === "ARS") {
      family.ars = Number(row.ultimoPrecio);
    } else if (symbolInfo.type === "USD") {
      const candidate = Number(row.ultimoPrecio);
      if (Number.isFinite(candidate) && candidate > 0) {
        family.usd = candidate;
      }
    }
  }

  for (const family of families.values()) {
    if (!Number.isFinite(family.ars) || !Number.isFinite(family.usd) || family.usd <= 0) {
      continue;
    }

    const implicit = Number((family.ars / family.usd).toFixed(4));
    for (const row of family.members) {
      row.mepCclImplicito = implicit;
    }
  }
}

function parseSymbolFamily(symbol) {
  if (!symbol) {
    return null;
  }

  const raw = String(symbol).trim().toUpperCase();
  if (!raw) {
    return null;
  }

  if (raw.endsWith(".D") || raw.endsWith(".C")) {
    return {
      base: raw.slice(0, -2),
      type: "USD"
    };
  }

  const last = raw.slice(-1);
  if ((last === "D" || last === "C") && raw.length > 1 && /^[A-Z0-9.]+$/.test(raw)) {
    return {
      base: raw.slice(0, -1),
      type: "USD"
    };
  }

  return {
    base: raw,
    type: "ARS"
  };
}

function buildExecutionStats(startedAt, endedAt, totalInstrumentos, totalRegistros, totalFallos) {
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  return {
    durationMs,
    durationText: formatDuration(durationMs),
    totals: {
      totalInstrumentos,
      totalRegistros,
      totalFallos
    },
    market: getMarketStatusArgentina(endedAt)
  };
}

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function getMarketStatusArgentina(referenceDate) {
  const local = getDateInArgentina(referenceDate);
  const day = local.getDay();
  const minutes = local.getHours() * 60 + local.getMinutes();
  const openMinutes = 11 * 60;
  const closeMinutes = 17 * 60;

  const closeAt = buildArgentinaTime(local, closeMinutes);
  const closeText = formatDateInArgentina(closeAt);

  if (day === 0 || day === 6) {
    return {
      status: "CERRADO",
      closeAt: closeText,
      label: `CERRADO (fin de semana). Cierre de referencia: ${closeText}`
    };
  }

  if (minutes >= openMinutes && minutes <= closeMinutes) {
    return {
      status: "ABIERTO",
      closeAt: closeText,
      label: `ABIERTO. Cierre: ${closeText}`
    };
  }

  return {
    status: "CERRADO",
    closeAt: closeText,
    label: `CERRADO. Ultimo cierre: ${closeText}`
  };
}

// Argentina uses a fixed UTC-3 offset (no DST since 2009), so the close-time
// instant is derived directly from date parts instead of running the
// getDateInArgentina() "disguise" trick a second time on an already-disguised
// value - that was a real bug (double-shifted the computed close time by the
// gap between the host machine's own timezone and Argentina's), invisible
// only because this has so far always run on a machine already set to
// Argentina time.
function buildArgentinaTime(argentinaLocalDate, minutesOfDay) {
  const utcMs =
    Date.UTC(argentinaLocalDate.getFullYear(), argentinaLocalDate.getMonth(), argentinaLocalDate.getDate()) +
    minutesOfDay * 60 * 1000 +
    3 * 60 * 60 * 1000;
  return new Date(utcMs);
}

// Precedence: CLI args / config.local.json (options.username+password) > OS credential
// vault (looked up by username) > interactive masked prompt (offers to save to the vault).
async function resolveCredentials(options, vaultService) {
  if (options.username && options.password) {
    return {
      username: options.username,
      password: options.password
    };
  }

  if (options.username) {
    const vaultPassword = vaultService.getPassword(options.username);
    if (vaultPassword) {
      return {
        username: options.username,
        password: vaultPassword
      };
    }
  }

  if (!options.interactive) {
    return {
      username: options.username,
      password: options.password
    };
  }

  const credentials = await promptForCredentials(options.username, options.password);

  if (credentials.username && credentials.password) {
    const shouldSave = await promptToSaveToVault();
    if (shouldSave) {
      vaultService.setPassword(credentials.username, credentials.password);
    }
  }

  return credentials;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error fatal: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  applyCalculatedImplicitCcl,
  resolveCredentials,
  shouldUseInteractiveMenu,
  formatTokenToFormatos,
  buildInstrumentTargetsFromSelection
};
