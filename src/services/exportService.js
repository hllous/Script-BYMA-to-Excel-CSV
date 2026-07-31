const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { NORMALIZED_FIELDS } = require("../config/constants");
const { pickNormalizedColumns } = require("../models/quoteSchema");

class ExportService {
  constructor({ outputDir, diagnosticsDir, logger }) {
    this.outputDir = outputDir;
    this.diagnosticsDir = diagnosticsDir || path.join(outputDir, "..", "diagnostics");
    this.logger = logger;
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(this.diagnosticsDir, { recursive: true });
  }

  exportData(records, formats, runId) {
    const normalizedRows = records.map((row) => pickNormalizedColumns(row));
    const createdFiles = [];

    if (formats.includes("csv")) {
      const csvPath = path.join(this.outputDir, `${runId}.csv`);
      writeCsv(csvPath, normalizedRows);
      createdFiles.push(csvPath);
      this.logger.info(`CSV exportado: ${csvPath}`);
    }

    if (formats.includes("xlsx")) {
      const xlsxPath = path.join(this.outputDir, `${runId}.xlsx`);
      writeXlsx(xlsxPath, normalizedRows);
      createdFiles.push(xlsxPath);
      this.logger.info(`XLSX exportado: ${xlsxPath}`);
    }

    return createdFiles;
  }

  exportAudit(auditObject, runId) {
    const auditPath = path.join(this.diagnosticsDir, `${runId}-audit.json`);
    fs.writeFileSync(auditPath, `${JSON.stringify(auditObject, null, 2)}\n`, "utf8");
    this.logger.info(`Auditoría exportada: ${auditPath}`);
    return auditPath;
  }
}

function writeCsv(filePath, rows) {
  const header = NORMALIZED_FIELDS.join(",");
  const lines = [header];

  for (const row of rows) {
    const values = NORMALIZED_FIELDS.map((field) => escapeCsv(row[field]));
    lines.push(values.join(","));
  }

  const csvText = `\uFEFF${lines.join("\n")}\n`;
  fs.writeFileSync(filePath, csvText, "utf8");
}

function writeXlsx(filePath, rows) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(rows, { header: NORMALIZED_FIELDS });
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  const grouped = groupByInstrument(rows);
  for (const instrument of Object.keys(grouped)) {
    const sheetName = sanitizeSheetName(instrument);
    const sheet = XLSX.utils.json_to_sheet(grouped[instrument], { header: NORMALIZED_FIELDS });
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  XLSX.writeFile(workbook, filePath);
}

function groupByInstrument(rows) {
  const grouped = {};
  for (const row of rows) {
    const key = row.instrumento || "sin_instrumento";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(row);
  }
  return grouped;
}

function sanitizeSheetName(name) {
  const clean = String(name || "Sheet")
    .replace(/[\\/\?\*\[\]:]/g, "_")
    .slice(0, 31);

  return clean || "Sheet";
}

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

module.exports = {
  ExportService
};
