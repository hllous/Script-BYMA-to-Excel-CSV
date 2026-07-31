# 07 - Move stored password to OS credential vault

Blocked by: (none)

## What

Add a dependency on a Windows credential-store library (`keytar` or `@napi-rs/keyring` — evaluate maintenance status of each before picking, `keytar` is effectively unmaintained upstream as of this writing). Store the IOL password in the OS credential vault instead of `config.local.json`. `config.local.json` retains the username (and other non-secret settings); the password field is removed from it and looked up from the vault at runtime, falling back to interactive prompt (ticket 06) if not present in the vault.

Provide a way to *set* the vault entry (e.g. a one-time setup prompt the first time credentials are entered interactively, offering to save to the vault for next time).

## Why

See `../spec.md` decision 7. Plain-text password storage in a JSON file on disk is a real gap.

## Acceptance

- No password field remains in `config.local.example.json` (update the example/template and any docs referencing it, e.g. README's "Configuración opcional" section).
- Password is read from the OS vault at runtime when present; falls back to interactive masked prompt (ticket 06) otherwise.
- After an interactive prompt, user is offered the option to save the entered password to the vault for future runs.
- `resolveCredentials` in `src/appRunner.js` updated to check the vault as a source, in the existing precedence chain (CLI args > vault > interactive prompt), documented clearly.
- Tests use a fake vault module (no real Windows Credential Manager calls in CI/test runs).

## Comments

- Library choice: `@napi-rs/keyring` over `keytar`. `keytar` is effectively unmaintained (archived upstream, last real dev activity stale); `@napi-rs/keyring` is actively published (latest release within the last few months as of this writing) and ships prebuilt native bindings via napi-rs (no node-gyp compile step), which matters more on a Windows-only tool like this one. Verified its `Entry` API directly (`setPassword`/`getPassword`/`deletePassword` against the real Windows Credential Manager) before committing to it.
- `src/services/credentialVaultService.js` — `CredentialVaultService` wraps `@napi-rs/keyring`'s `Entry` behind `getPassword`/`setPassword`/`deletePassword`, with an injectable `vaultFactory` so tests never touch the real Windows vault (`test/services/credentialVaultService.test.js`, 5 tests, fake in-memory factory).
- `src/appRunner.js`'s `resolveCredentials` now takes a `vaultService` param and follows this precedence, documented inline: CLI args/config.local.json (both present) > vault lookup by username > interactive masked prompt (falls back here only if `options.interactive`). After a successful interactive entry, `promptToSaveToVault()` (new `Confirm` prompt in `src/utils/prompt.js`) offers to persist the password to the vault for next time. `resolveCredentials` exported from `appRunner.js` for testing; `test/appRunner.resolveCredentials.test.js` (4 tests) covers the non-interactive branches with a fake vault — the interactive+save-prompt branch isn't unit tested since it needs a real TTY (same limitation noted on ticket 02's picker smoke test).
- `config.local.example.json`: removed the `password` field. README (both ES and EN sections) updated to say the password is requested once (masked) and optionally saved to the vault, not stored in `config.local.json`.
- Note: the user's real (gitignored) `config.local.json` still has a plaintext `password` field from before this ticket — left untouched since it's the user's local secrets file, not something to edit unprompted. It still works as before (top of the precedence chain), but they may want to remove it manually and let the vault take over. Not blocking — out of scope to touch by hand.
- 83-test suite green.
