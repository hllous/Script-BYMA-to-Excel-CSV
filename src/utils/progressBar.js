"use strict";

const BAR_WIDTH = 30;

// Renders (or updates in place, via \r) a single-line progress bar. Callers
// must call this again with current === total to print the closing newline -
// otherwise the next line of output would continue on the same row.
function renderProgressBar({ label, current, total }) {
  const ratio = total > 0 ? current / total : 1;
  const filled = Math.round(BAR_WIDTH * ratio);
  const bar = "#".repeat(filled) + "-".repeat(BAR_WIDTH - filled);
  const pct = Math.round(ratio * 100);

  process.stdout.write(`\r${label} [${bar}] ${pct}% (${current}/${total})`);
  if (current >= total) {
    process.stdout.write("\n");
  }
}

module.exports = { renderProgressBar };
