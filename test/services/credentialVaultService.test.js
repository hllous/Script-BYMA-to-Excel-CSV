const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CredentialVaultService, SERVICE_NAME } = require("../../src/services/credentialVaultService");

function makeFakeVaultFactory() {
  const store = new Map();
  const calls = [];

  const factory = (service, account) => {
    calls.push({ service, account });
    const key = `${service}::${account}`;
    return {
      getPassword: () => (store.has(key) ? store.get(key) : null),
      setPassword: (password) => store.set(key, password),
      deletePassword: () => {
        if (!store.has(key)) {
          throw new Error("no entry");
        }
        store.delete(key);
      }
    };
  };

  return { factory, calls, store };
}

test("getPassword returns null when nothing is stored for the username", () => {
  const { factory } = makeFakeVaultFactory();
  const vault = new CredentialVaultService({ vaultFactory: factory });

  assert.equal(vault.getPassword("nico"), null);
});

test("getPassword returns null without touching the vault when username is falsy", () => {
  const { factory, calls } = makeFakeVaultFactory();
  const vault = new CredentialVaultService({ vaultFactory: factory });

  assert.equal(vault.getPassword(null), null);
  assert.equal(calls.length, 0);
});

test("setPassword then getPassword round-trips the stored value, scoped to service name + username", () => {
  const { factory, calls } = makeFakeVaultFactory();
  const vault = new CredentialVaultService({ vaultFactory: factory });

  vault.setPassword("nico", "hunter2");

  assert.equal(vault.getPassword("nico"), "hunter2");
  assert.ok(calls.every((call) => call.service === SERVICE_NAME));
  assert.equal(vault.getPassword("otro-usuario"), null);
});

test("deletePassword removes a stored entry", () => {
  const { factory } = makeFakeVaultFactory();
  const vault = new CredentialVaultService({ vaultFactory: factory });

  vault.setPassword("nico", "hunter2");
  vault.deletePassword("nico");

  assert.equal(vault.getPassword("nico"), null);
});

test("deletePassword is a no-op (does not throw) when nothing is stored", () => {
  const { factory } = makeFakeVaultFactory();
  const vault = new CredentialVaultService({ vaultFactory: factory });

  assert.doesNotThrow(() => vault.deletePassword("nunca-guardado"));
});
