const fs = require("node:fs");
const path = require("node:path");

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
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;
    console.log(line);
    fs.appendFileSync(this.logFilePath, `${line}\n`, "utf8");
  }
}

module.exports = {
  Logger
};
