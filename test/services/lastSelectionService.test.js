const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { LastSelectionService } = require("../../src/services/lastSelectionService");

function makeFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lastSelectionService-test-"));
  return path.join(dir, "last-selection.json");
}

test("readSelection returns null when the file does not exist", () => {
  const service = new LastSelectionService({ filePath: makeFilePath() });
  assert.equal(service.readSelection(), null);
});

test("writeSelection then readSelection round-trips the selection shape", () => {
  const service = new LastSelectionService({ filePath: makeFilePath() });
  const selection = { categories: ["acciones"], symbols: [{ category: "cedears", simbolo: "AAPL" }] };

  service.writeSelection(selection);

  assert.deepEqual(service.readSelection(), selection);
});

test("writeSelection overwrites a previously stored selection", () => {
  const service = new LastSelectionService({ filePath: makeFilePath() });

  service.writeSelection({ categories: ["acciones"], symbols: [] });
  service.writeSelection({ categories: [], symbols: [{ category: "cedears", simbolo: "AAPL" }] });

  assert.deepEqual(service.readSelection(), { categories: [], symbols: [{ category: "cedears", simbolo: "AAPL" }] });
});
