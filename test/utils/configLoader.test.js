const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadLocalConfig } = require("../../src/utils/configLoader");

function makeTempFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "configLoader-test-"));
  const filePath = path.join(dir, "config.local.json");
  if (content !== undefined) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  return filePath;
}

test("loadLocalConfig returns {} when the path is falsy", () => {
  assert.deepEqual(loadLocalConfig(null), {});
  assert.deepEqual(loadLocalConfig(""), {});
});

test("loadLocalConfig returns {} when the file does not exist", () => {
  const missingPath = path.join(os.tmpdir(), "configLoader-test-does-not-exist", "config.local.json");
  assert.deepEqual(loadLocalConfig(missingPath), {});
});

test("loadLocalConfig returns {} when the file is empty", () => {
  const filePath = makeTempFile("   ");
  assert.deepEqual(loadLocalConfig(filePath), {});
});

test("loadLocalConfig parses valid JSON into an object", () => {
  const filePath = makeTempFile(JSON.stringify({ username: "nico", pageSize: 50 }));
  assert.deepEqual(loadLocalConfig(filePath), { username: "nico", pageSize: 50 });
});

test("loadLocalConfig throws a descriptive error on malformed JSON", () => {
  const filePath = makeTempFile("{ not valid json");
  assert.throws(() => loadLocalConfig(filePath), /No se pudo parsear/);
});
