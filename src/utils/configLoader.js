const fs = require("node:fs");
const path = require("node:path");

function loadLocalConfig(configPath) {
  if (!configPath) {
    return {};
  }

  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    return {};
  }

  const raw = fs.readFileSync(absolutePath, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`No se pudo parsear ${absolutePath}: ${error.message}`);
  }
}

module.exports = {
  loadLocalConfig
};
