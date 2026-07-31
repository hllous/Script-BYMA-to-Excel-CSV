const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveCredentials } = require("../src/appRunner");

function makeFakeVault(passwords = {}) {
  const calls = { getPassword: [], setPassword: [] };
  return {
    calls,
    getPassword: (username) => {
      calls.getPassword.push(username);
      return Object.prototype.hasOwnProperty.call(passwords, username) ? passwords[username] : null;
    },
    setPassword: (username, password) => {
      calls.setPassword.push({ username, password });
    }
  };
}

test("resolveCredentials returns options username/password directly when both are already present, without touching the vault", async () => {
  const vault = makeFakeVault({ nico: "should-not-be-used" });

  const result = await resolveCredentials({ username: "nico", password: "hunter2", interactive: true }, vault);

  assert.deepEqual(result, { username: "nico", password: "hunter2" });
  assert.equal(vault.calls.getPassword.length, 0);
});

test("resolveCredentials falls back to the vault when a username is present but no password", async () => {
  const vault = makeFakeVault({ nico: "vault-password" });

  const result = await resolveCredentials({ username: "nico", password: null, interactive: true }, vault);

  assert.deepEqual(result, { username: "nico", password: "vault-password" });
  assert.deepEqual(vault.calls.getPassword, ["nico"]);
});

test("resolveCredentials skips the interactive prompt when interactive=false and nothing is in the vault", async () => {
  const vault = makeFakeVault();

  const result = await resolveCredentials({ username: "nico", password: null, interactive: false }, vault);

  assert.deepEqual(result, { username: "nico", password: null });
});

test("resolveCredentials skips the vault lookup entirely when no username is available yet", async () => {
  const vault = makeFakeVault();

  const result = await resolveCredentials({ username: null, password: null, interactive: false }, vault);

  assert.deepEqual(result, { username: null, password: null });
  assert.equal(vault.calls.getPassword.length, 0);
});
