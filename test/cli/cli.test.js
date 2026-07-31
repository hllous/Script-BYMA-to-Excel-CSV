const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP_ENTRY = path.resolve(__dirname, "../../src/appRunner.js");

function runCli(args, options = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  return spawnSync("node", [APP_ENTRY, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, IOL_USERNAME: "", IOL_PASSWORD: "", ...options.env },
    ...options
  });
}

test("--help prints usage and exits 0 without requiring credentials or network", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Recolector BYMA con IOL API/);
  assert.match(result.stdout, /--instrumentos=all\|acciones,cedears,letras,bonos,ons,fci,etfs,opciones/);
  assert.match(result.stdout, /--help/);
});

test("--help lists every documented CLI parameter", () => {
  const result = runCli(["--help"]);

  for (const flag of ["--username", "--password", "--pais", "--panel", "--formato", "--salida", "--concurrency"]) {
    assert.ok(result.stdout.includes(flag), `expected --help output to mention ${flag}`);
  }
});

test("exits with a non-zero status and a descriptive error when no IOL credentials are available", () => {
  const result = runCli(["--interactive=false"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No hay credenciales de IOL/);
});

test("accepts credentials via CLI flags without needing config.local.json or env vars", () => {
  const result = runCli(["--interactive=false", "--username=nico", "--password=hunter2", "--timeoutMs=1", "--retries=0"]);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /No hay credenciales de IOL/);
});

test("--instrumentos and --formato still take the direct/legacy path instead of the interactive picker", () => {
  const result = runCli([
    "--interactive=false",
    "--instrumentos=acciones",
    "--formato=csv",
    "--username=nico",
    "--password=hunter2",
    "--timeoutMs=1",
    "--retries=0"
  ]);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /No hay credenciales de IOL/);
  assert.doesNotMatch(result.stderr, /No hay caché de símbolos/);
});
