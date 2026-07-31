const path = require("node:path");

const DEFAULT_APP_NAME = "ScriptIOLExcel";

class RuntimePathsService {
  constructor({ isPackaged = Boolean(process.pkg), env = process.env, cwd = process.cwd(), appName = DEFAULT_APP_NAME } = {}) {
    this.isPackaged = isPackaged;
    this.env = env;
    this.cwd = cwd;
    this.appName = appName;
  }

  get rootDir() {
    if (!this.isPackaged) {
      return this.cwd;
    }

    return path.join(this.env.LOCALAPPDATA || this.env.APPDATA || this.cwd, this.appName);
  }

  get settingsPath() {
    return path.join(this.rootDir, this.isPackaged ? "settings.json" : "config.local.json");
  }

  get symbolCachePath() {
    return path.join(this.rootDir, "data", "symbols.json");
  }

  get lastSelectionPath() {
    return path.join(this.rootDir, this.isPackaged ? "last-selection.json" : ".last-selection.json");
  }

  get outputDir() {
    return path.join(this.rootDir, "output");
  }

  get diagnosticsDir() {
    return path.join(this.rootDir, "diagnostics");
  }
}

module.exports = {
  RuntimePathsService,
  DEFAULT_APP_NAME
};
