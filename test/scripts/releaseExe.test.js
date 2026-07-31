const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  getSigningConfiguration,
  buildSignedRelease,
  getUnsignedReleaseConfiguration,
  buildUnsignedRelease,
  publishSignedRelease,
  publishUnsignedRelease,
  smokePackagedExecutable
} = require("../../scripts/release-exe");

test("getSigningConfiguration refuses to create a release without an Authenticode certificate", () => {
  assert.throws(
    () => getSigningConfiguration({}),
    /SIGN_CERT_PATH.*SIGN_CERT_PASSWORD.*SIGN_TIMESTAMP_URL/
  );
});

test("getSigningConfiguration accepts an explicit signing configuration", () => {
  assert.deepEqual(
    getSigningConfiguration({
      SIGN_CERT_PATH: "C:\\secure\\publisher.pfx",
      SIGN_CERT_PASSWORD: "secret",
      SIGN_TIMESTAMP_URL: "https://timestamp.example.test",
      SIGNTOOL_PATH: "C:\\sdk\\signtool.exe"
    }),
    {
      certificatePath: "C:\\secure\\publisher.pfx",
      certificatePassword: "secret",
      timestampUrl: "https://timestamp.example.test",
      signToolPath: "C:\\sdk\\signtool.exe"
    }
  );
});

test("getUnsignedReleaseConfiguration requires an explicit acknowledgement", () => {
  assert.throws(() => getUnsignedReleaseConfiguration({}), /ALLOW_UNSIGNED_RELEASE=true/);
  assert.doesNotThrow(() => getUnsignedReleaseConfiguration({ ALLOW_UNSIGNED_RELEASE: "true" }));
});

test("buildSignedRelease builds, tests, and smoke-tests the executable before signing and verifying it", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "releaseExe-test-"));
  const exePath = path.join(workDir, "ScriptIOLExcel.exe");
  const calls = [];

  buildSignedRelease({
    env: {
      SIGN_CERT_PATH: "C:\\secure\\publisher.pfx",
      SIGN_CERT_PASSWORD: "secret",
      SIGN_TIMESTAMP_URL: "https://timestamp.example.test",
      SIGNTOOL_PATH: "signtool.exe"
    },
    build: () => {
      calls.push("build");
      fs.writeFileSync(exePath, "binary");
      return { exePath };
    },
    runTests: () => calls.push("test"),
    runSmoke: () => calls.push("smoke"),
    execFile: (command, args) => calls.push(`${command} ${args[0]}`)
  });

  assert.deepEqual(calls, ["build", "test", "smoke", "signtool.exe sign", "signtool.exe verify"]);
  assert.match(fs.readFileSync(path.join(workDir, "SHA256SUMS.txt"), "utf8"), /ScriptIOLExcel\.exe/);
});

test("buildUnsignedRelease builds, tests, and smoke-tests before writing a checksum", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "unsignedRelease-test-"));
  const exePath = path.join(workDir, "ScriptIOLExcel.exe");
  const calls = [];

  buildUnsignedRelease({
    build: () => {
      calls.push("build");
      fs.writeFileSync(exePath, "binary");
      return { exePath };
    },
    runTests: () => calls.push("test"),
    runSmoke: () => calls.push("smoke")
  });

  assert.deepEqual(calls, ["build", "test", "smoke"]);
  assert.match(fs.readFileSync(path.join(workDir, "SHA256SUMS.txt"), "utf8"), /ScriptIOLExcel\.exe/);
});

test("publishSignedRelease uploads only the signed executable and its checksum", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "publishRelease-test-"));
  const notesPath = path.join(workDir, "notes.md");
  fs.writeFileSync(notesPath, "## Español\n", "utf8");
  const calls = [];

  publishSignedRelease({
    env: { RELEASE_TAG: "v1.0.1", RELEASE_TITLE: "v1.0.1", RELEASE_NOTES_FILE: notesPath },
    buildRelease: () => ({ exePath: "C:\\dist\\ScriptIOLExcel.exe", checksumPath: "C:\\dist\\SHA256SUMS.txt" }),
    execFile: (command, args) => calls.push({ command, args })
  });

  assert.deepEqual(calls, [
    {
      command: "gh",
      args: [
        "release",
        "create",
        "v1.0.1",
        "C:\\dist\\ScriptIOLExcel.exe",
        "C:\\dist\\SHA256SUMS.txt",
        "--title",
        "v1.0.1",
        "--notes-file",
        notesPath
      ]
    }
  ]);
});

test("publishUnsignedRelease uploads only after explicit acknowledgement", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "publishUnsignedRelease-test-"));
  const notesPath = path.join(workDir, "notes.md");
  fs.writeFileSync(notesPath, "## Español\n", "utf8");
  const calls = [];

  publishUnsignedRelease({
    env: {
      ALLOW_UNSIGNED_RELEASE: "true",
      RELEASE_TAG: "v1.0.1",
      RELEASE_TITLE: "v1.0.1",
      RELEASE_NOTES_FILE: notesPath
    },
    buildRelease: () => ({ exePath: "C:\\dist\\ScriptIOLExcel.exe", checksumPath: "C:\\dist\\SHA256SUMS.txt" }),
    execFile: (command, args) => calls.push({ command, args })
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 5), [
    "release",
    "create",
    "v1.0.1",
    "C:\\dist\\ScriptIOLExcel.exe",
    "C:\\dist\\SHA256SUMS.txt"
  ]);
});

test("smokePackagedExecutable verifies help and packaged user-data initialization from a separate working directory", () => {
  const invocations = [];

  smokePackagedExecutable("dist/ScriptIOLExcel.exe", {
    execFile: (exePath, args, options) => {
      invocations.push({ exePath, args, options });
      if (args.includes("--help")) {
        return "Recolector BYMA con IOL API";
      }

      fs.mkdirSync(path.join(options.env.LOCALAPPDATA, "ScriptIOLExcel", "output"), { recursive: true });
      const error = new Error("missing credentials");
      error.stderr = "Error fatal: No hay credenciales de IOL";
      throw error;
    }
  });

  assert.equal(invocations[0].exePath, path.resolve("dist/ScriptIOLExcel.exe"));
  assert.deepEqual(invocations.map((item) => item.args), [["--help"], ["--interactive=false"]]);
  assert.notEqual(invocations[0].options.cwd, process.cwd());
  assert.equal(invocations[0].options.env.LOCALAPPDATA, invocations[1].options.env.LOCALAPPDATA);
});
