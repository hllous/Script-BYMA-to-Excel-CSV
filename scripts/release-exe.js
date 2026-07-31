const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildExecutable } = require("./build-exe");

function getSigningConfiguration(env) {
  const required = ["SIGN_CERT_PATH", "SIGN_CERT_PASSWORD", "SIGN_TIMESTAMP_URL"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`No se puede crear una release firmada: faltan ${missing.join(", ")}.`);
  }

  return {
    certificatePath: env.SIGN_CERT_PATH,
    certificatePassword: env.SIGN_CERT_PASSWORD,
    timestampUrl: env.SIGN_TIMESTAMP_URL,
    signToolPath: env.SIGNTOOL_PATH || "signtool.exe"
  };
}

function signAndVerifyExecutable(exePath, signing, { execFile = execFileSync } = {}) {
  execFile(
    signing.signToolPath,
    [
      "sign",
      "/fd",
      "SHA256",
      "/tr",
      signing.timestampUrl,
      "/td",
      "SHA256",
      "/f",
      signing.certificatePath,
      "/p",
      signing.certificatePassword,
      exePath
    ],
    { stdio: "inherit" }
  );
  execFile(signing.signToolPath, ["verify", "/pa", "/all", "/tw", "/v", exePath], { stdio: "inherit" });
}

function writeChecksum(exePath) {
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(exePath)).digest("hex");
  const checksumPath = path.join(path.dirname(exePath), "SHA256SUMS.txt");
  fs.writeFileSync(checksumPath, `${checksum}  ${path.basename(exePath)}\n`, "utf8");
  return checksumPath;
}

function runReleaseTests({ execFile = execFileSync } = {}) {
  execFile("npm", ["test"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

function smokePackagedExecutable(exePath, { execFile = execFileSync } = {}) {
  const absoluteExePath = path.resolve(exePath);
  const smokeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "script-iol-exe-smoke-"));
  const smokeAppData = path.join(smokeDirectory, "LocalAppData");
  const smokeEnv = { ...process.env, LOCALAPPDATA: smokeAppData, APPDATA: smokeAppData };
  try {
    const output = execFile(absoluteExePath, ["--help"], { cwd: smokeDirectory, encoding: "utf8", env: smokeEnv });
    if (!String(output).includes("Recolector BYMA con IOL API")) {
      throw new Error("El ejecutable empaquetado no respondió correctamente a --help.");
    }

    try {
      execFile(absoluteExePath, ["--interactive=false"], { cwd: smokeDirectory, encoding: "utf8", env: smokeEnv });
      throw new Error("El ejecutable empaquetado debía fallar sin credenciales en modo no interactivo.");
    } catch (error) {
      const outputText = `${error.stdout || ""}${error.stderr || ""}`;
      if (!outputText.includes("No hay credenciales de IOL")) {
        throw error;
      }
    }

    const expectedOutputDir = path.join(smokeAppData, "ScriptIOLExcel", "output");
    if (!fs.existsSync(expectedOutputDir)) {
      throw new Error("El ejecutable empaquetado no inicializó su directorio de datos por usuario.");
    }
  } finally {
    fs.rmSync(smokeDirectory, { recursive: true, force: true });
  }
}

function buildSignedRelease({
  env = process.env,
  runTests = runReleaseTests,
  runSmoke = smokePackagedExecutable,
  build = buildExecutable,
  execFile = execFileSync
} = {}) {
  const signing = getSigningConfiguration(env);
  const { exePath } = build();
  runTests();
  runSmoke(exePath);
  signAndVerifyExecutable(exePath, signing, { execFile });
  const checksumPath = writeChecksum(exePath);
  console.log(`Release firmada y verificada: ${exePath}`);
  console.log(`Checksum: ${checksumPath}`);
  return { exePath, checksumPath };
}

function getPublishConfiguration(env) {
  const required = ["RELEASE_TAG", "RELEASE_TITLE", "RELEASE_NOTES_FILE"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`No se puede publicar la release: faltan ${missing.join(", ")}.`);
  }
  if (!fs.existsSync(env.RELEASE_NOTES_FILE)) {
    throw new Error(`No existe el archivo de notas de release: ${env.RELEASE_NOTES_FILE}`);
  }

  return { tag: env.RELEASE_TAG, title: env.RELEASE_TITLE, notesPath: env.RELEASE_NOTES_FILE };
}

function publishSignedRelease({ env = process.env, buildRelease = buildSignedRelease, execFile = execFileSync } = {}) {
  const publish = getPublishConfiguration(env);
  const { exePath, checksumPath } = buildRelease();
  execFile(
    "gh",
    [
      "release",
      "create",
      publish.tag,
      exePath,
      checksumPath,
      "--title",
      publish.title,
      "--notes-file",
      publish.notesPath
    ],
    { stdio: "inherit" }
  );
}

if (require.main === module) {
  if (process.argv.includes("--publish")) {
    publishSignedRelease();
  } else {
    buildSignedRelease();
  }
}

module.exports = {
  getSigningConfiguration,
  signAndVerifyExecutable,
  writeChecksum,
  runReleaseTests,
  smokePackagedExecutable,
  buildSignedRelease,
  getPublishConfiguration,
  publishSignedRelease
};
