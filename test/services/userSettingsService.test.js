const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { UserSettingsService } = require("../../src/services/userSettingsService");

function makeSettingsPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "userSettingsService-test-")), "settings.json");
}

test("getUsername returns null before a username has been saved", () => {
  const service = new UserSettingsService({ filePath: makeSettingsPath() });
  assert.equal(service.getUsername(), null);
});

test("saveUsername persists the non-secret username while preserving existing settings", () => {
  const filePath = makeSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify({ pais: "argentina" }), "utf8");
  const service = new UserSettingsService({ filePath });

  service.saveUsername("nico");

  assert.equal(service.getUsername(), "nico");
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { pais: "argentina", username: "nico" });
});

test("saveOutputDirectory persists the chosen output folder while preserving existing settings", () => {
  const filePath = makeSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify({ username: "nico" }), "utf8");
  const service = new UserSettingsService({ filePath });

  service.saveOutputDirectory("C:\\Users\\nico\\Exports");

  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {
    username: "nico",
    salida: "C:\\Users\\nico\\Exports"
  });
});

test("clearCredentials removes saved login details without changing the output folder", () => {
  const filePath = makeSettingsPath();
  fs.writeFileSync(
    filePath,
    JSON.stringify({ username: "nico", password: "legacy-password", salida: "C:\\Exports" }),
    "utf8"
  );
  const service = new UserSettingsService({ filePath });

  service.clearCredentials();

  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { salida: "C:\\Exports" });
});

test("saveUseDateFolders persists the output date-folder preference while preserving other settings", () => {
  const filePath = makeSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify({ salida: "C:\\Exports" }), "utf8");
  const service = new UserSettingsService({ filePath });

  assert.equal(service.getUseDateFolders(), false);
  service.saveUseDateFolders(true);

  assert.equal(service.getUseDateFolders(), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {
    salida: "C:\\Exports",
    carpetasPorFecha: true
  });
});

test("saveOutputFileName persists a custom output name and clears it when automatic naming is restored", () => {
  const filePath = makeSettingsPath();
  const service = new UserSettingsService({ filePath });

  assert.equal(service.getOutputFileName(), null);
  service.saveOutputFileName("cotizaciones");
  assert.equal(service.getOutputFileName(), "cotizaciones");

  service.saveOutputFileName(null);
  assert.equal(service.getOutputFileName(), null);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {});
});

test("custom output file naming is disabled by default and can be toggled without losing the saved name", () => {
  const filePath = makeSettingsPath();
  const service = new UserSettingsService({ filePath });

  assert.equal(service.getUseCustomOutputFileName(), false);
  service.saveOutputFileName("cotizaciones");
  assert.equal(service.getUseCustomOutputFileName(), true);

  service.saveUseCustomOutputFileName(false);
  assert.equal(service.getUseCustomOutputFileName(), false);
  assert.equal(service.getOutputFileName(), "cotizaciones");
});
