const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const exePath = path.join(distDir, "ScriptIOLExcel.exe");

fs.mkdirSync(distDir, { recursive: true });

execFileSync(
  "npx",
  ["pkg", "src/appRunner.js", "--targets", "node22-win-x64", "--output", exePath],
  { cwd: repoRoot, stdio: "inherit", shell: true }
);

fs.mkdirSync(path.join(distDir, "data"), { recursive: true });
fs.copyFileSync(
  path.join(repoRoot, "data", "symbols.json"),
  path.join(distDir, "data", "symbols.json")
);

console.log(`\nListo: ${exePath}`);
console.log("Para distribuir, compartir dist/ScriptIOLExcel.exe junto con dist/data/symbols.json (misma carpeta).");
