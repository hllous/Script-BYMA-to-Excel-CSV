const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, printHelp } = require("./utils/argParser");
const {
  promptForCredentials,
  promptToSaveToVault,
  promptToDeleteApplicationData,
  promptToDeleteCustomOutputDirectory
} = require("./utils/prompt");
const {
  promptForOutputFormat,
  promptForOutputDirectory,
  promptForStartupAction,
  promptForSymbolSelectionWithReuse,
  promptForInstrumentSelection,
  promptForPostRunAction,
  START_CHOICE,
  CHANGE_OUTPUT_CHOICE,
  LOGIN_CHOICE,
  LOGOUT_CHOICE,
  UNINSTALL_CHOICE,
  EXIT_CHOICE,
  BACK_CHOICE
} = require("./interactiveMenu");
const { loadLocalConfig } = require("./utils/configLoader");
const { Logger } = require("./utils/logger");
const { getDateInArgentina, formatDateInArgentina, formatFileTimestampInArgentina } = require("./utils/dateFormat");
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
const { RuntimePathsService } = require("./services/runtimePathsService");
const { UserSettingsService } = require("./services/userSettingsService");
const { uninstallExecutableData } = require("./services/uninstallService");

async function main() {
  const cliOptions = parseArgs(process.argv);
  if (cliOptions.help) {
    printHelp();
    return;
  }

  const runtimePaths = new RuntimePathsService();
  if (shouldShowExecutableStartupMenu(cliOptions, runtimePaths)) {
    const shouldStart = await runExecutableStartupMenu(runtimePaths, cliOptions);
    if (!shouldStart) {
      return;
    }
  }
  const localConfig = loadLocalConfig(runtimePaths.settingsPath);
  const options = mergeOptions(cliOptions, localConfig, { outputDir: runtimePaths.outputDir });
  const vaultService = new CredentialVaultService();
  const settingsService = runtimePaths.isPackaged
    ? new UserSettingsService({ filePath: runtimePaths.settingsPath })
    : { saveUsername: () => {}, saveOutputDirectory: () => {}, clearCredentials: () => {} };
  const startupLogger = new Logger(path.join(runtimePaths.diagnosticsDir, "startup.log"));
  const session = await authenticateBeforeSelection(options, {
    vaultService,
    settingsService,
    createServices: (credentials) => buildIolServices(options, credentials, startupLogger)
  });
  options.username = session.credentials.username;
  options.password = session.credentials.password;

  const useInteractiveMenu = shouldUseInteractiveMenu(options, cliOptions);
  // The packaged executable changes this setting from its first-level menu so
  // it is available before authentication. The development/run.bat workflow
  // keeps its existing in-flow prompt.
  if (useInteractiveMenu && !runtimePaths.isPackaged) {
    options.salida = await promptForOutputDirectory(options.salida);
    settingsService.saveOutputDirectory(options.salida);
  }
  const symbolCacheService = useInteractiveMenu
    ? new SymbolCacheService({
        authService: session.authService,
        discoveryService: session.discoveryService,
        cachePath: runtimePaths.symbolCachePath,
        logger: startupLogger
      })
    : null;
  const lastSelectionService = useInteractiveMenu ? new LastSelectionService({ filePath: runtimePaths.lastSelectionPath }) : null;

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
            onUpdateSymbolList: () => refreshSymbolCacheInteractively(options, symbolCacheService, session, startupLogger)
          });
          hasPromptedThisSession = true;
        } else {
          selection = await promptForInstrumentSelection({
            cache,
            onUpdateSymbolList: () => refreshSymbolCacheInteractively(options, symbolCacheService, session, startupLogger)
          });
          // Saved immediately (not deferred to process exit) so that whatever
          // was last picked in this session is what a future run offers to
          // reuse - promptForSymbolSelectionWithReuse already does this same
          // write for the first-ever selection above. Navigation requests are
          // deliberately not selections and must never replace that history.
          if (!selection.mainMenu && !selection.exit) {
            lastSelectionService.writeSelection(selection);
          }
        }

        if (selection.mainMenu) {
          console.clear();
          return main();
        }
        if (selection.exit) {
          return;
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
    const outputDir = path.resolve(options.salida || runtimePaths.outputDir);
    const diagnosticsDir = runtimePaths.diagnosticsDir;
    settingsService.saveOutputDirectory(outputDir);
    const runId = buildAvailableRunId(buildRunId(selectedDefinitions.map((item) => item.key), startedAt), [
      outputDir,
      diagnosticsDir
    ]);
    const logger = new Logger(path.join(diagnosticsDir, `${runId}.log`));

    console.log(`\nCarpeta de salida: ${outputDir}`);
    logger.info("Inicio de ejecución");
    logger.info(`Instrumentos solicitados: ${selectedDefinitions.map((item) => item.key).join(",")}`);

    setSessionLogger(session, logger);
    const { authService, iolHttpClient, discoveryService } = session;
    const aggregationService = new QuoteAggregationService({ iolHttpClient, logger });
    const exportService = new ExportService({ outputDir, diagnosticsDir, logger });

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

    logger.info(`Archivos exportados: ${createdFiles.join(" | ")}`);
    logger.info(`Auditoría: ${auditPath}`);
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
    console.log("\nArchivos exportados:");
    for (const filePath of createdFiles) {
      console.log(`  - ${filePath}`);
    }
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
      } else if (postRunAction === "main-menu") {
        console.clear();
        return main();
      } else if (postRunAction === LOGOUT_CHOICE) {
        await logOutAccount(vaultService, settingsService, options.username);
        console.clear();
        return main();
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

function shouldShowExecutableStartupMenu(cliOptions, runtimePaths) {
  return (
    runtimePaths.isPackaged &&
    cliOptions.interactive !== false &&
    cliOptions.instrumentos === null &&
    cliOptions.formatos === null
  );
}

async function runExecutableStartupMenu(runtimePaths, cliOptions) {
  const settingsService = new UserSettingsService({ filePath: runtimePaths.settingsPath });
  const vaultService = new CredentialVaultService();

  for (;;) {
    printHomeBanner();
    const savedSettings = readUninstallSettings(runtimePaths.settingsPath);
    const startupAction = await promptForStartupAction({ hasSavedSession: Boolean(savedSettings.username) });

    if (startupAction === START_CHOICE || startupAction === LOGIN_CHOICE) {
      console.clear();
      return true;
    }

    if (startupAction === EXIT_CHOICE) {
      return false;
    }

    if (startupAction === UNINSTALL_CHOICE) {
      await runUninstallFlow(runtimePaths);
      console.clear();
      continue;
    }

    if (startupAction === CHANGE_OUTPUT_CHOICE) {
      const savedSettings = readUninstallSettings(runtimePaths.settingsPath);
      const savedOptions = mergeOptions(cliOptions, savedSettings, { outputDir: runtimePaths.outputDir });
      const selectedOutputDir = await promptForOutputDirectory(savedOptions.salida);
      settingsService.saveOutputDirectory(selectedOutputDir);
      console.clear();
      continue;
    }

    if (startupAction === LOGOUT_CHOICE) {
      await logOutAccount(vaultService, settingsService, settingsService.getUsername());
      console.clear();
      continue;
    }
  }
}

async function logOutAccount(vaultService, settingsService, username) {
  if (!username) {
    console.log("No hay una sesión de IOL guardada en este equipo.");
    return false;
  }

  vaultService.deletePassword(username);
  settingsService.clearCredentials();
  console.log("La sesión guardada de IOL fue cerrada. Se solicitarán credenciales al iniciar nuevamente.");
  return true;
}

async function runUninstallFlow(runtimePaths) {
  const result = await uninstallExecutableData({
    runtimePaths,
    readSettings: () => readUninstallSettings(runtimePaths.settingsPath),
    confirmAppDataDeletion: promptToDeleteApplicationData,
    confirmCustomOutputDeletion: promptToDeleteCustomOutputDirectory
  });
  console.log(result.removedAppData ? "Datos locales eliminados." : "Desinstalación cancelada.");
  if (result.removedCustomOutput) {
    console.log("La carpeta de salida personalizada también fue eliminada.");
  }
}

function setSessionLogger(session, logger) {
  session.authService.logger = logger;
  session.iolHttpClient.logger = logger;
  session.discoveryService.logger = logger;
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
    const cachedSymbols = cache.categories[key];
    if (!Array.isArray(cachedSymbols) || cachedSymbols.length === 0) continue;

    const symbolRecords = cachedSymbols.map((symbol) => ({
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
    const cacheEntry = (cache.categories[category] || []).find((symbol) => symbol.simbolo === simbolo);
    if (!cacheEntry) continue;

    if (!plan.has(category)) {
      plan.set(category, { definition, symbolRecords: [] });
    }

    plan.get(category).symbolRecords.push({
      simbolo,
      descripcion: cacheEntry ? cacheEntry.descripcion : null,
      mercado: null,
      panel: null
    });
  }

  return Array.from(plan.values());
}

// Triggered from the picker's "Update symbol list from IOL" action. It reuses the
// already authenticated session created before the picker, so refresh neither prompts
// again nor creates a second login/client stack.
async function refreshSymbolCacheInteractively(options, symbolCacheService, session, logger) {
  setSessionLogger(session, logger);
  symbolCacheService.logger = logger;
  return symbolCacheService.refreshSymbolCache({
    pais: options.pais,
    panel: options.panel,
    pageSize: options.pageSize,
    maxPages: options.maxPages
  });
}

function mergeOptions(cliOptions, localConfig, { outputDir = DEFAULTS.outputDir } = {}) {
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
    salida: firstDefined(cliOptions.salida, config.salida, outputDir),
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

function buildRunId(instrumentKeys, startedAt) {
  const allKeys = INSTRUMENT_DEFINITIONS.map((item) => item.key);
  const sorted = [...new Set(instrumentKeys)].sort();
  const isAll = allKeys.length === sorted.length && allKeys.every((key) => sorted.includes(key));
  const instrumentToken = isAll ? "all" : sorted.join("-");
  const safeToken = instrumentToken.replace(/[^a-zA-Z0-9\-]/g, "-").slice(0, 80);
  return `byma-${safeToken}-${formatFileTimestampInArgentina(startedAt)}`;
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

// Precedence: CLI args / settings file (options.username+password) > OS credential
// vault (looked up by username) > interactive masked prompt. Persistence happens only
// after authenticateBeforeSelection has confirmed the credentials with IOL.
async function resolveCredentials(options, vaultService, { promptCredentials = promptForCredentials, skipVault = false } = {}) {
  const candidate = await resolveCredentialCandidate(options, vaultService, { promptCredentials, skipVault });
  return candidate.credentials;
}

function readUninstallSettings(settingsPath) {
  try {
    return loadLocalConfig(settingsPath);
  } catch {
    // A malformed optional settings file must not prevent the user from
    // removing the executable's complete local-data directory.
    return {};
  }
}

function buildAvailableRunId(baseRunId, directories) {
  let candidate = baseRunId;
  let suffix = 2;
  while (directories.some((directory) => runArtifactsExist(directory, candidate))) {
    candidate = `${baseRunId}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function runArtifactsExist(directory, runId) {
  return [".csv", ".xlsx", "-audit.json", ".log"].some((suffix) => fs.existsSync(path.join(directory, `${runId}${suffix}`)));
}

async function resolveCredentialCandidate(options, vaultService, { promptCredentials = promptForCredentials, skipVault = false } = {}) {
  if (options.username && options.password) {
    return { credentials: { username: options.username, password: options.password }, source: "supplied" };
  }

  if (options.username && !skipVault) {
    const vaultPassword = vaultService.getPassword(options.username);
    if (vaultPassword) {
      return { credentials: { username: options.username, password: vaultPassword }, source: "vault" };
    }
  }

  if (!options.interactive) {
    return { credentials: { username: options.username, password: options.password }, source: "unavailable" };
  }

  return { credentials: await promptCredentials(options.username, options.password), source: "prompted" };
}

async function authenticateBeforeSelection(
  options,
  {
    vaultService,
    settingsService,
    promptCredentials = promptForCredentials,
    promptSaveToVault = promptToSaveToVault,
    createServices,
    reportAuthenticationError = (error) => console.error(`No se pudo iniciar sesión en IOL: ${error.message}`)
  }
) {
  let candidateOptions = { ...options };
  let skipVault = false;

  for (;;) {
    const candidate = await resolveCredentialCandidate(candidateOptions, vaultService, { promptCredentials, skipVault });
    const { credentials } = candidate;
    if (!credentials.username || !credentials.password) {
      throw new Error("No hay credenciales de IOL. Use args, variables de entorno o complete el inicio de sesión.");
    }

    const services = createServices(credentials);
    try {
      await services.authService.getAccessToken();
    } catch (error) {
      if (!options.interactive || !isCredentialRejection(error)) {
        throw error;
      }
      reportAuthenticationError(error);
      // A rejected username is just as likely as a rejected password. Clear both
      // values so the next prompt is a complete credential retry rather than an
      // endless password-only retry against the same account.
      candidateOptions = { ...candidateOptions, username: null, password: null };
      skipVault = true;
      continue;
    }

    settingsService.saveUsername(credentials.username);
    if (candidate.source === "prompted") {
      const shouldSave = await promptSaveToVault();
      if (shouldSave) {
        vaultService.setPassword(credentials.username, credentials.password);
      }
    }

    return { credentials, ...services };
  }
}

function isCredentialRejection(error) {
  const status = error && error.response ? error.response.status : null;
  return [400, 401, 403].includes(status);
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
  authenticateBeforeSelection,
  refreshSymbolCacheInteractively,
  shouldUseInteractiveMenu,
  formatTokenToFormatos,
  buildInstrumentTargetsFromSelection,
  buildRunId,
  buildAvailableRunId
};
