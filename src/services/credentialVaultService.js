const { Entry } = require("@napi-rs/keyring");

const SERVICE_NAME = "script-iol-excel";

class CredentialVaultService {
  constructor({ vaultFactory } = {}) {
    this.vaultFactory = vaultFactory || ((service, account) => new Entry(service, account));
  }

  getPassword(username) {
    if (!username) {
      return null;
    }
    try {
      // keyring-rs (the underlying native binding) throws when no entry exists
      // for this service+account, it doesn't return null/undefined - a first
      // run with a configured username but nothing saved yet must not crash.
      return this.vaultFactory(SERVICE_NAME, username).getPassword();
    } catch {
      return null;
    }
  }

  setPassword(username, password) {
    this.vaultFactory(SERVICE_NAME, username).setPassword(password);
  }

  deletePassword(username) {
    try {
      this.vaultFactory(SERVICE_NAME, username).deletePassword();
    } catch {
      // Nothing stored for this account; deleting is already a no-op.
    }
  }
}

module.exports = {
  CredentialVaultService,
  SERVICE_NAME
};
