const { DEFAULTS, INSTRUMENT_DEFINITIONS } = require("../config/constants");

function parseArgs(argv) {
  const args = {};

  for (const token of argv.slice(2)) {
    if (!token.startsWith("--")) {
      continue;
    }

    const clean = token.slice(2);
    const separatorIndex = clean.indexOf("=");

    if (separatorIndex === -1) {
      args[clean] = true;
      continue;
    }

    const key = clean.slice(0, separatorIndex);
    const value = clean.slice(separatorIndex + 1);
    args[key] = value;
  }

  if (args.help) {
    return { help: true };
  }

  return {
    help: false,
    username: args.username || process.env.IOL_USERNAME || null,
    password: args.password || process.env.IOL_PASSWORD || null,
    instrumentos: args.instrumentos ? parseInstrumentSelection(args.instrumentos) : null,
    pais: args.pais || null,
    panel: args.panel || null,
    formatos: args.formato ? parseFormatSelection(args.formato) : null,
    salida: args.salida || null,
    pageSize: toPositiveIntegerOrNull(args.pageSize),
    maxPages: toPositiveIntegerOrNull(args.maxPages),
    concurrency: toPositiveIntegerOrNull(args.concurrency),
    timeoutMs: toPositiveIntegerOrNull(args.timeoutMs),
    retries: toPositiveIntegerOrNull(args.retries),
    uninstall: args.uninstall === true,
    interactive: args.interactive === undefined ? null : !isFalsey(args.interactive)
  };
}

function parseInstrumentSelection(value) {
  const all = INSTRUMENT_DEFINITIONS.map((item) => item.key);
  if (!value || value.toLowerCase() === "all") {
    return all;
  }

  const requested = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const valid = new Set(all);
  const filtered = requested.filter((item) => valid.has(item));
  return filtered.length > 0 ? filtered : all;
}

function parseFormatSelection(value) {
  if (!value || value.toLowerCase() === "both") {
    return [...DEFAULTS.formatos];
  }

  const formatSet = new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  const formats = [];
  if (formatSet.has("csv")) {
    formats.push("csv");
  }
  if (formatSet.has("xlsx") || formatSet.has("excel")) {
    formats.push("xlsx");
  }

  return formats.length > 0 ? formats : [...DEFAULTS.formatos];
}

function toPositiveIntegerOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function isFalsey(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "false" || normalized === "0" || normalized === "no";
}

function printHelp() {
  const instrumentKeys = INSTRUMENT_DEFINITIONS.map((item) => item.key).join(",");

  console.log("Recolector BYMA con IOL API");
  console.log("");
  console.log("Uso:");
  console.log("  node src/appRunner.js --instrumentos=all");
  console.log("");
  console.log("Parámetros disponibles:");
  console.log("  --username=<usuario>       Usuario de IOL");
  console.log("  --password=<password>      Password de IOL");
  console.log(`  --instrumentos=all|${instrumentKeys}`);
  console.log("  --pais=<pais>              Por defecto: argentina");
  console.log("  --panel=<panel>            Por defecto: general");
  console.log("  --formato=both|csv|xlsx    Por defecto: both");
  console.log("  --salida=<carpeta>         Por defecto: output");
  console.log("  --pageSize=<n>             Por defecto: 100");
  console.log("  --maxPages=<n>             Por defecto: 200");
  console.log("  --concurrency=<n>          Por defecto: 5");
  console.log("  --timeoutMs=<n>            Por defecto: 20000");
  console.log("  --retries=<n>              Por defecto: 3");
  console.log("  --interactive=true|false   Por defecto: true");
  console.log("  --uninstall                 Elimina datos locales del ejecutable (con confirmación)");
  console.log("  --help                     Muestra esta ayuda");
}

module.exports = {
  parseArgs,
  printHelp
};
