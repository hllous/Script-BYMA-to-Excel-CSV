const fs = require("node:fs");
const path = require("node:path");

class UserSettingsService {
  constructor({ filePath }) {
    this.filePath = filePath;
  }

  getUsername() {
    return this.readSettings().username || null;
  }

  saveUsername(username) {
    this.writeSettings({ ...this.readSettings(), username });
  }

  saveOutputDirectory(outputDirectory) {
    this.writeSettings({ ...this.readSettings(), salida: outputDirectory });
  }

  getUseDateFolders() {
    return this.readSettings().carpetasPorFecha === true;
  }

  saveUseDateFolders(enabled) {
    this.writeSettings({ ...this.readSettings(), carpetasPorFecha: enabled === true });
  }

  clearCredentials() {
    const settings = this.readSettings();
    delete settings.username;
    delete settings.password;
    this.writeSettings(settings);
  }

  readSettings() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  }

  writeSettings(settings) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  }
}

module.exports = {
  UserSettingsService
};
