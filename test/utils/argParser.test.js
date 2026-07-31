const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("../../src/utils/argParser");
const { INSTRUMENT_DEFINITIONS } = require("../../src/config/constants");

const ALL_KEYS = INSTRUMENT_DEFINITIONS.map((item) => item.key);

function argv(...flags) {
  return ["node", "src/appRunner.js", ...flags];
}

test("parseArgs returns { help: true } and nothing else when --help is passed", () => {
  const result = parseArgs(argv("--help", "--username=nico"));
  assert.deepEqual(result, { help: true });
});

test("parseArgs defaults to help:false and null fields when no flags are passed", () => {
  const result = parseArgs(argv());

  assert.equal(result.help, false);
  assert.equal(result.username, null);
  assert.equal(result.instrumentos, null);
  assert.equal(result.pageSize, null);
});

test("parseArgs reads username/password from flags", () => {
  const result = parseArgs(argv("--username=nico", "--password=hunter2"));
  assert.equal(result.username, "nico");
  assert.equal(result.password, "hunter2");
});

test("parseArgs recognizes --uninstall without requiring credentials", () => {
  const result = parseArgs(argv("--uninstall"));
  assert.equal(result.uninstall, true);
});

test("parseArgs expands --instrumentos=all to every known instrument key", () => {
  const result = parseArgs(argv("--instrumentos=all"));
  assert.deepEqual(result.instrumentos.sort(), [...ALL_KEYS].sort());
});

test("parseArgs filters --instrumentos to only recognized keys, dropping unknown ones", () => {
  const result = parseArgs(argv("--instrumentos=acciones,noexiste,cedears"));
  assert.deepEqual(result.instrumentos, ["acciones", "cedears"]);
});

test("parseArgs falls back to all instruments when every requested key is unrecognized", () => {
  const result = parseArgs(argv("--instrumentos=noexiste,tampoco"));
  assert.deepEqual(result.instrumentos.sort(), [...ALL_KEYS].sort());
});

test("parseArgs maps --formato=csv to ['csv'] only", () => {
  const result = parseArgs(argv("--formato=csv"));
  assert.deepEqual(result.formatos, ["csv"]);
});

test("parseArgs maps --formato=excel to ['xlsx']", () => {
  const result = parseArgs(argv("--formato=excel"));
  assert.deepEqual(result.formatos, ["xlsx"]);
});

test("parseArgs maps --formato=both (or omitted) to both formats", () => {
  const result = parseArgs(argv("--formato=both"));
  assert.deepEqual(result.formatos, ["csv", "xlsx"]);
});

test("parseArgs parses positive integer options and rejects invalid ones as null", () => {
  const valid = parseArgs(argv("--pageSize=50", "--retries=2"));
  assert.equal(valid.pageSize, 50);
  assert.equal(valid.retries, 2);

  const invalid = parseArgs(argv("--pageSize=-5", "--retries=abc"));
  assert.equal(invalid.pageSize, null);
  assert.equal(invalid.retries, null);
});

test("parseArgs treats --interactive=false/0/no as false, anything else truthy as true", () => {
  assert.equal(parseArgs(argv("--interactive=false")).interactive, false);
  assert.equal(parseArgs(argv("--interactive=0")).interactive, false);
  assert.equal(parseArgs(argv("--interactive=no")).interactive, false);
  assert.equal(parseArgs(argv("--interactive=true")).interactive, true);
  assert.equal(parseArgs(argv()).interactive, null);
});
