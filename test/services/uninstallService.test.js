const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { uninstallExecutableData } = require("../../src/services/uninstallService");

function makeRuntimePaths(rootDir) {
  return {
    isPackaged: true,
    rootDir,
    settingsPath: path.join(rootDir, "settings.json"),
    outputDir: path.join(rootDir, "output")
  };
}

test("uninstallExecutableData removes app data and a confirmed custom output directory", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "scriptIol-uninstall-"));
  const customOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "scriptIol-custom-output-"));
  fs.writeFileSync(path.join(rootDir, "settings.json"), JSON.stringify({ salida: customOutputDir }), "utf8");
  fs.writeFileSync(path.join(customOutputDir, "export.csv"), "data", "utf8");

  const result = await uninstallExecutableData({
    runtimePaths: makeRuntimePaths(rootDir),
    readSettings: () => JSON.parse(fs.readFileSync(path.join(rootDir, "settings.json"), "utf8")),
    confirmAppDataDeletion: async () => true,
    confirmCustomOutputDeletion: async () => true
  });

  assert.deepEqual(result, { removedAppData: true, removedCustomOutput: true });
  assert.equal(fs.existsSync(rootDir), false);
  assert.equal(fs.existsSync(customOutputDir), false);
});

test("uninstallExecutableData leaves a custom output directory when its deletion is declined", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "scriptIol-uninstall-"));
  const customOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "scriptIol-custom-output-"));
  fs.writeFileSync(path.join(rootDir, "settings.json"), JSON.stringify({ salida: customOutputDir }), "utf8");

  const result = await uninstallExecutableData({
    runtimePaths: makeRuntimePaths(rootDir),
    readSettings: () => ({ salida: customOutputDir }),
    confirmAppDataDeletion: async () => true,
    confirmCustomOutputDeletion: async () => false
  });

  assert.deepEqual(result, { removedAppData: true, removedCustomOutput: false });
  assert.equal(fs.existsSync(rootDir), false);
  assert.equal(fs.existsSync(customOutputDir), true);
  fs.rmSync(customOutputDir, { recursive: true, force: true });
});

test("uninstallExecutableData refuses to delete a development working directory", async () => {
  await assert.rejects(
    () =>
      uninstallExecutableData({
        runtimePaths: { isPackaged: false, rootDir: "C:\\repo", settingsPath: "C:\\repo\\config.local.json", outputDir: "C:\\repo\\output" }
      }),
    /solo está disponible desde el ejecutable/
  );
});
