const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { RuntimePathsService } = require("../../src/services/runtimePathsService");

test("packaged runs store mutable state under LocalAppData instead of the working directory", () => {
  const paths = new RuntimePathsService({
    isPackaged: true,
    env: { LOCALAPPDATA: "C:\\Users\\Nico\\AppData\\Local" },
    cwd: "C:\\Downloads",
    appName: "ScriptIOLExcel"
  });

  const root = path.join("C:\\Users\\Nico\\AppData\\Local", "ScriptIOLExcel");
  assert.equal(paths.rootDir, root);
  assert.equal(paths.settingsPath, path.join(root, "settings.json"));
  assert.equal(paths.symbolCachePath, path.join(root, "data", "symbols.json"));
  assert.equal(paths.lastSelectionPath, path.join(root, "last-selection.json"));
  assert.equal(paths.outputDir, path.join(root, "output"));
});

test("development runs retain repository-local config and output paths", () => {
  const paths = new RuntimePathsService({
    isPackaged: false,
    env: {},
    cwd: "D:\\repos\\script-iol-excel"
  });

  assert.equal(paths.rootDir, "D:\\repos\\script-iol-excel");
  assert.equal(paths.settingsPath, path.join("D:\\repos\\script-iol-excel", "config.local.json"));
  assert.equal(paths.symbolCachePath, path.join("D:\\repos\\script-iol-excel", "data", "symbols.json"));
  assert.equal(paths.lastSelectionPath, path.join("D:\\repos\\script-iol-excel", ".last-selection.json"));
  assert.equal(paths.outputDir, path.join("D:\\repos\\script-iol-excel", "output"));
});
