const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SELECTION_PATH = ".last-selection.json";

class LastSelectionService {
  constructor({ filePath } = {}) {
    this.filePath = filePath || DEFAULT_SELECTION_PATH;
  }

  readSelection() {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  writeSelection(selection) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");
  }
}

module.exports = {
  LastSelectionService,
  DEFAULT_SELECTION_PATH
};
