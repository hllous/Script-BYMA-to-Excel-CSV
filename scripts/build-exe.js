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

console.log(`\nListo: ${exePath}`);
console.log("El ejecutable ya incluye la caché de símbolos - se puede distribuir solo.");
