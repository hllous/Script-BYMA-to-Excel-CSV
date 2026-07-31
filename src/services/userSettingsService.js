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
    const settings = this.readSettings();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify({ ...settings, username }, null, 2)}\n`, "utf8");
  }

  readSettings() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  }
}

module.exports = {
  UserSettingsService
};
