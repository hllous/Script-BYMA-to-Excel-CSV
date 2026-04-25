const path = require("node:path");
const { parseArgs, printHelp } = require("./utils/argParser");
const { promptForCredentials } = require("./utils/prompt");
const { loadLocalConfig } = require("./utils/configLoader");
const { Logger } = require("./utils/logger");
const { DEFAULTS, INSTRUMENT_DEFINITIONS } = require("./config/constants");
const { AuthService } = require("./services/authService");
const { IolHttpClient } = require("./services/iolHttpClient");
const { InstrumentDiscoveryService } = require("./services/instrumentDiscoveryService");
const { QuoteAggregationService } = require("./services/quoteAggregationService");
const { ExportService } = require("./services/exportService");

async function main() {
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const cliOptions = parseArgs(process.argv);
  if (cliOptions.help) {
    printHelp();
    return;
  }

  const localConfig = loadLocalConfig(path.resolve(process.cwd(), "config.local.json"));
  const options = mergeOptions(cliOptions, localConfig);

  const selectedDefinitions = INSTRUMENT_DEFINITIONS.filter((definition) =>
    options.instrumentos.includes(definition.key)
  );

  if (selectedDefinitions.length === 0) {
    throw new Error("La seleccion de instrumentos no contiene opciones validas");
  }

  const runId = buildRunId(selectedDefinitions.map((item) => item.key), startedAtIso);
  const outputDir = path.resolve(process.cwd(), options.salida || DEFAULTS.outputDir);
  const logger = new Logger(path.join(outputDir, `${runId}.log`));

  logger.info("Inicio de ejecucion");
  logger.info(`Instrumentos solicitados: ${options.instrumentos.join(",")}`);

  const credentials = await resolveCredentials(options);
  if (!credentials.username || !credentials.password) {
    throw new Error("No hay credenciales de IOL. Use args, variables de entorno o config.local.json");
  }

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
  const aggregationService = new QuoteAggregationService({ iolHttpClient, logger });
  const exportService = new ExportService({ outputDir, logger });

  await authService.getAccessToken();

  const allRows = [];
  const allFailures = [];

  for (const definition of selectedDefinitions) {
    logger.info(`Procesando instrumento ${definition.key}...`);

    try {
      const discovery = await discoveryService.getInstrumentSymbols(definition, {
        pais: options.pais,
        panel: options.panel,
        pageSize: options.pageSize,
        maxPages: options.maxPages
      });

      if (!discovery.symbols.length) {
        logger.warn(`No se encontraron simbolos para ${definition.key}`);
        continue;
      }

      const aggregation = await aggregationService.aggregateInstrumentQuotes(definition, discovery.symbols, {
        pais: options.pais,
        panel: options.panel,
        concurrency: options.concurrency
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
  logger.info("Ejecucion finalizada");
  logger.info(`Duracion total: ${executionStats.durationText}`);
  logger.info(`Mercado: ${executionStats.market.label}`);

  console.log("\n=== Estadisticas de corrida ===");
  console.log(`Inicio: ${formatDateInArgentina(startedAt)}`);
  console.log(`Fin: ${formatDateInArgentina(endedAt)}`);
  console.log(`Duracion: ${executionStats.durationText}`);
  console.log(`Mercado: ${executionStats.market.label}`);
  console.log(`\nRegistros exportados: ${allRows.length}`);
  console.log(`Fallos: ${allFailures.length}`);
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

function buildArgentinaTime(baseDate, minutesOfDay) {
  const local = getDateInArgentina(baseDate);
  const result = new Date(local);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesOfDay);
  return result;
}

function getDateInArgentina(sourceDate) {
  return new Date(sourceDate.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function formatDateInArgentina(date) {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

async function resolveCredentials(options) {
  if (options.username && options.password) {
    return {
      username: options.username,
      password: options.password
    };
  }

  if (!options.interactive) {
    return {
      username: options.username,
      password: options.password
    };
  }

  return promptForCredentials(options.username, options.password);
}

main().catch((error) => {
  console.error(`Error fatal: ${error.message}`);
  process.exitCode = 1;
});
