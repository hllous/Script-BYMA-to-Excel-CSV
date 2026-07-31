const fs = require("node:fs");
const path = require("node:path");
const { formatDateInArgentina } = require("./dateFormat");

class Logger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath;
    const directory = path.dirname(logFilePath);
    fs.mkdirSync(directory, { recursive: true });
  }

  info(message) {
    this.write("INFO", message);
  }

  warn(message) {
    this.write("WARN", message);
  }

  error(message) {
    this.write("ERROR", message);
  }

  write(level, message) {
    const timestamp = formatDateInArgentina(new Date());
    const line = `[${timestamp}] [${level}] ${message}`;
    // Deliberately file-only: the console shows a progress bar and a final
    // stats summary instead of a scrolling log, see appRunner.js.
    fs.appendFileSync(this.logFilePath, `${line}\n`, "utf8");
  }
}

module.exports = {
  Logger
};
