const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveCredentials, authenticateBeforeSelection } = require("../src/appRunner");

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

test("authenticateBeforeSelection retries invalid prompted credentials and saves only the authenticated password", async () => {
  const vault = makeFakeVault();
  const savedUsernames = [];
  const prompted = [
    { username: "nico", password: "wrong" },
    { username: "nico", password: "correct" }
  ];
  const authenticationErrors = [];

  const result = await authenticateBeforeSelection(
    { username: null, password: null, interactive: true },
    {
      vaultService: vault,
      settingsService: { saveUsername: (username) => savedUsernames.push(username) },
      promptCredentials: async () => prompted.shift(),
      promptSaveToVault: async () => true,
      createServices: (credentials) => ({
        authService: {
          getAccessToken: async () => {
            if (credentials.password === "wrong") {
              const error = new Error("Credenciales inválidas");
              error.response = { status: 401 };
              throw error;
            }
          }
        }
      }),
      reportAuthenticationError: (error) => authenticationErrors.push(error.message)
    }
  );

  assert.deepEqual(result.credentials, { username: "nico", password: "correct" });
  assert.deepEqual(vault.calls.setPassword, [{ username: "nico", password: "correct" }]);
  assert.deepEqual(savedUsernames, ["nico"]);
  assert.deepEqual(authenticationErrors, ["Credenciales inválidas"]);
});

test("authenticateBeforeSelection retries the complete credential pair after a rejected username", async () => {
  const prompted = [
    { username: "wrong-user", password: "wrong-password" },
    { username: "correct-user", password: "correct-password" }
  ];

  const result = await authenticateBeforeSelection(
    { username: null, password: null, interactive: true },
    {
      vaultService: makeFakeVault(),
      settingsService: { saveUsername: () => {} },
      promptCredentials: async () => prompted.shift(),
      promptSaveToVault: async () => false,
      createServices: (credentials) => ({
        authService: {
          getAccessToken: async () => {
            if (credentials.username === "wrong-user") {
              const error = new Error("Credenciales inválidas");
              error.response = { status: 401 };
              throw error;
            }
          }
        }
      }),
      reportAuthenticationError: () => {}
    }
  );

  assert.deepEqual(result.credentials, { username: "correct-user", password: "correct-password" });
});

test("authenticateBeforeSelection validates vault credentials without prompting", async () => {
  const vault = makeFakeVault({ nico: "vault-password" });
  let prompted = false;

  const result = await authenticateBeforeSelection(
    { username: "nico", password: null, interactive: true },
    {
      vaultService: vault,
      settingsService: { saveUsername: () => {} },
      promptCredentials: async () => {
        prompted = true;
        return { username: "nico", password: "unexpected" };
      },
      createServices: () => ({ authService: { getAccessToken: async () => {} } })
    }
  );

  assert.deepEqual(result.credentials, { username: "nico", password: "vault-password" });
  assert.equal(prompted, false);
});

test("authenticateBeforeSelection stops on an operational authentication failure instead of reprompting forever", async () => {
  let prompted = false;

  await assert.rejects(
    () =>
      authenticateBeforeSelection(
        { username: "nico", password: "password", interactive: true },
        {
          vaultService: makeFakeVault(),
          settingsService: { saveUsername: () => {} },
          promptCredentials: async () => {
            prompted = true;
            return { username: "nico", password: "another" };
          },
          createServices: () => ({ authService: { getAccessToken: async () => { throw new Error("Network timeout"); } } })
        }
      ),
    /Network timeout/
  );

  assert.equal(prompted, false);
});
