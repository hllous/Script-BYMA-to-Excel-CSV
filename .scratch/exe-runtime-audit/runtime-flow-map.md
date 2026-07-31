# EXE runtime flow map

Scope: map the shipped Windows executable's first-run and repeat-run behaviour before changing production code. Evidence was inspected on 2026-07-31 from `src/appRunner.js`, storage services, `scripts/build-exe.js`, the freshly built `dist/ScriptIOLExcel.exe`, and release `v1.0.0`.

## Current interactive flow

```text
Windows trust prompt (outside the app; executable is unsigned)
  -> bundled symbol-cache seed is copied to the current working directory
  -> instrument selection / optional cache refresh
  -> output-format selection
  -> username/password prompt only if credentials are missing
  -> optional password save to Windows Credential Manager
  -> first IOL authentication attempt
  -> quote aggregation -> export -> post-run menu
```

This order is implemented by the selection loop before `resolveCredentials()` in `src/appRunner.js`. It contradicts the desired first-run experience: a user invests time selecting instruments before learning that credentials are needed or invalid.

## Proposed interactive flow

```text
Windows download/run trust
  -> application-data bootstrap (writable per-user location)
  -> credentials preflight
       -> known username + vault password: validate with IOL
       -> otherwise: masked username/password prompt, validate with IOL
       -> invalid: explain and retry; do not save to vault
       -> valid + opt in: save password and non-secret username preference
  -> load/seed local symbol cache
  -> instrument selection (refresh uses the authenticated session)
  -> output-format selection
  -> quote aggregation -> export -> post-run menu
```

`--interactive=false` remains a non-prompting path: missing or invalid credentials should fail early with actionable CLI guidance.

## State and gap matrix

| State | Current behaviour | Required behaviour |
| --- | --- | --- |
| Windows trust | `Get-AuthenticodeSignature dist/ScriptIOLExcel.exe` reports `NotSigned`. The build only packages with `pkg`. | Release pipeline signs, RFC 3161 timestamps, and verifies the final binary; publish a checksum. Signing gives a verified publisher/integrity, but SmartScreen reputation can still warn on newly released binaries. |
| First launch, no credentials | Shows cached-symbol picker first; prompts only after symbol and format choices. | Prompt and validate IOL credentials before the picker. |
| Invalid first-run credentials | The password can be saved to the vault before `authService.getAccessToken()` validates it; then the process exits fatally. | Authenticate before vault persistence; show the error and retry the credential step. |
| Repeat launch after vault opt-in, no config file | The vault lookup requires `options.username`, but the prompted username is not persisted; the user must re-enter it. | Persist a non-secret preferred username in per-user app settings, then look up its password in the vault. |
| Cache refresh | Refresh independently resolves credentials and creates a second auth/client stack. | Reuse the validated session; refresh cache, reconcile selection, and return to the fresh picker. |
| Working directories | Cache, last selection, `config.local.json`, and output use `process.cwd()`. Launching from a different or read-only folder can split state or fail. | Store cache, selection, settings, and logs under a per-user writable application-data directory; make output location an explicit user-facing choice/default. |
| Executable identity | File metadata identifies it as `Node.js JavaScript Runtime` / `node.exe`. | Configure final product metadata if the packaging tool supports it, and make the release asset/version consistent with the app name. |
| Release integrity | GitHub reports an asset SHA-256 digest, but no user-facing checksum file or signing gate exists. | Publish `SHA256SUMS.txt`; verify signature and checksum before release upload. |

## Sequenced implementation plan

1. Decide the signing authority and secret-storage approach. It is an external prerequisite: no source change alone can turn `NotSigned` into a verified publisher.
2. Add a release gate: build -> automated tests -> Authenticode sign -> RFC 3161 timestamp -> SignTool verification -> checksum -> upload immutable release.
3. Introduce one executable runtime-path service. It owns per-user settings/cache/selection/log/output locations instead of scattered `process.cwd()` paths.
4. Separate `credential collection`, `credential validation`, and `credential persistence`. Persist only after IOL accepts the credentials.
5. Move credential preflight before interactive selection and retain an authenticated session for refresh and export.
6. Add first-run, invalid-login/retry, vault repeat-run, and alternate-working-directory executable smoke tests.

See `windows-trust-research.md` for official Microsoft/GitHub guidance and source links.
