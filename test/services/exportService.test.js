const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const XLSX = require("xlsx");
const { ExportService } = require("../../src/services/exportService");
const { NORMALIZED_FIELDS } = require("../../src/config/constants");

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function makeOutputDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "exportService-test-"));
}

test("exportData writes a CSV with a header row matching NORMALIZED_FIELDS and a UTF-8 BOM", () => {
  const outputDir = makeOutputDir();
  const service = new ExportService({ outputDir, logger: makeLogger() });

  const created = service.exportData(
    [{ instrumento: "acciones", simbolo: "GGAL", descripcion: "Grupo Galicia" }],
    ["csv"],
    "run-1"
  );

  assert.equal(created.length, 1);
  const csvPath = path.join(outputDir, "run-1.csv");
  assert.equal(created[0], csvPath);

  const raw = fs.readFileSync(csvPath, "utf8");
  assert.equal(raw.charCodeAt(0), 0xfeff);

  const lines = raw.slice(1).trim().split("\n");
  assert.equal(lines[0], NORMALIZED_FIELDS.join(","));
  assert.match(lines[1], /"acciones"/);
  assert.match(lines[1], /"GGAL"/);
});

test("exportData quotes fields and escapes embedded double quotes", () => {
  const outputDir = makeOutputDir();
  const service = new ExportService({ outputDir, logger: makeLogger() });

  service.exportData([{ instrumento: "acciones", descripcion: 'Contains "quotes"' }], ["csv"], "run-2");

  const raw = fs.readFileSync(path.join(outputDir, "run-2.csv"), "utf8");
  assert.match(raw, /""quotes""/);
});

test("exportData writes a bare empty field (no quotes) for missing values in the CSV", () => {
  const outputDir = makeOutputDir();
  const service = new ExportService({ outputDir, logger: makeLogger() });

  service.exportData([{ instrumento: "acciones" }], ["csv"], "run-3");

  const raw = fs.readFileSync(path.join(outputDir, "run-3.csv"), "utf8");
  const dataLine = raw.split("\n")[1];
  assert.equal(dataLine, `"acciones",${",".repeat(13)}`);
});

test("exportData only creates files for the requested formats", () => {
  const outputDir = makeOutputDir();
  const service = new ExportService({ outputDir, logger: makeLogger() });

  const created = service.exportData([{ instrumento: "acciones" }], ["csv"], "run-4");

  assert.equal(created.length, 1);
  assert.ok(!fs.existsSync(path.join(outputDir, "run-4.xlsx")));
});

test("exportData writes an XLSX workbook with a Resumen sheet plus one sheet per instrument", () => {
  const outputDir = makeOutputDir();
  const service = new ExportService({ outputDir, logger: makeLogger() });

  service.exportData(
    [
      { instrumento: "acciones", simbolo: "GGAL" },
      { instrumento: "cedears", simbolo: "AAPL" }
    ],
    ["xlsx"],
    "run-5"
  );

  const xlsxPath = path.join(outputDir, "run-5.xlsx");
  assert.ok(fs.existsSync(xlsxPath));

  const workbook = XLSX.readFile(xlsxPath);
  assert.deepEqual(workbook.SheetNames, ["Resumen", "acciones", "cedears"]);

  const accionesSheet = XLSX.utils.sheet_to_json(workbook.Sheets.acciones);
  assert.equal(accionesSheet.length, 1);
  assert.equal(accionesSheet[0].simbolo, "GGAL");
});

test("exportAudit writes pretty-printed JSON matching the given object", () => {
  const outputDir = makeOutputDir();
  const diagnosticsDir = path.join(outputDir, "..", "diagnostics");
  const service = new ExportService({ outputDir, diagnosticsDir, logger: makeLogger() });

  const auditPath = service.exportAudit({ runId: "run-6", totalRegistros: 3 }, "run-6");

  assert.equal(auditPath, path.join(diagnosticsDir, "run-6-audit.json"));
  assert.ok(!fs.existsSync(path.join(outputDir, "run-6-audit.json")));
  const parsed = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  assert.deepEqual(parsed, { runId: "run-6", totalRegistros: 3 });
});

test("constructor creates the output directory if it does not exist", () => {
  const parent = makeOutputDir();
  const outputDir = path.join(parent, "nested", "output");

  new ExportService({ outputDir, logger: makeLogger() });

  assert.ok(fs.existsSync(outputDir));
});

test("constructor creates the diagnostics directory separately from data exports", () => {
  const parent = makeOutputDir();
  const outputDir = path.join(parent, "exports");
  const diagnosticsDir = path.join(parent, "diagnostics");

  new ExportService({ outputDir, diagnosticsDir, logger: makeLogger() });

  assert.ok(fs.existsSync(outputDir));
  assert.ok(fs.existsSync(diagnosticsDir));
});
