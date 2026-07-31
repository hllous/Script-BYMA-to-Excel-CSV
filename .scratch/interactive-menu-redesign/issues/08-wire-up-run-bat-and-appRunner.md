# 08 - Wire everything together: run.bat + appRunner.js

Blocked by: 01, 04, 05, 06, 07

## What

Final integration slice. Reduce `run.bat` to: check/install `node_modules`, then invoke the new Node interactive menu (keep the `:RUN_DIRECT` non-interactive passthrough for direct CLI-flag invocation unchanged). Wire `src/appRunner.js`'s `main()` to call the new interactive menu (last-selection check → picker → format step → credentials) when `options.interactive` is true and no instrument/format selection was supplied via CLI flags, producing the new runtime order from `../spec.md`:

picker (or skipped via last-selection reuse) → credentials → login → aggregation for only selected symbols → CCL calc → export.

`InstrumentDiscoveryService` is no longer called from the normal run path — only from the picker's "Update symbol list" action (ticket 04).

## Why

Brings all prior tickets together into the actual end-to-end interactive experience described in `../spec.md`.

## Acceptance

- Running `run.bat` with no arguments goes straight into the new Node interactive flow, no batch `choice`/`set /p` prompts remain.
- `run.bat` with CLI args still works via `:RUN_DIRECT` exactly as before (regression-check against `test/cli/cli.test.js`).
- A full manual run (real IOL login) exercises: last-selection prompt, picker (including category toggle and update-symbol-list), format step, masked credential prompt, and a successful CSV/XLSX export for only the selected symbols.
- `test/cli/cli.test.js` updated/extended as needed to reflect the new non-interactive flag-based path (interactive-picker paths are not practical to test via `spawnSync` and should be covered by unit tests on the picker/menu modules instead, per the seams already used elsewhere in `test/`).

## Comments

Implemented this session:

- `run.bat`: removed the entire `choice`/`set /p` `:MENU` block (instrument choice, custom lista manual, format choice) and the now-unreachable `:EXIT_BATCH` label. No-arg invocation now just calls `node src\appRunner.js --salida=...` and lets the new interactive flow (defaults to `interactive: true`) take over. `:RUN_DIRECT` (used for direct CLI-flag invocation) is untouched.
- `src/appRunner.js`:
  - `shouldUseInteractiveMenu(options, cliOptions)` — the gate: interactive menu only runs when `options.interactive` is true AND neither `--instrumentos` nor `--formato` was passed on the CLI (checked via the raw `cliOptions`, before `mergeOptions` fills in defaults). Passing either flag takes the pre-existing legacy/direct path unchanged — this is what keeps `:RUN_DIRECT` and the CLI regression tests working exactly as before.
  - Interactive path: reads `data/symbols.json` via `SymbolCacheService.readCache()` (throws a clear error if missing — no live discovery fallback, matching decision 3), then `promptForSymbolSelectionWithReuse()` (ticket 05) → `promptForOutputFormat()` (ticket 02) → only *then* `resolveCredentials()` → login. Matches the spec's runtime order exactly: no network/login call happens before the picker and format step resolve.
  - `buildInstrumentTargetsFromSelection(selection, cache)` — converts the picker's `{categories, symbols}` shape into `{definition, symbolRecords}[]` built entirely from the cache (no discovery call), for both fully-selected categories and ad-hoc individual picks.
  - The aggregation loop was refactored to accept a uniform `instrumentTargets` list (`{definition, symbolRecords}`): interactive targets carry pre-resolved `symbolRecords` from cache; legacy/direct-CLI targets pass `symbolRecords: null` and the loop falls back to the original `discoveryService.getInstrumentSymbols()` call, unchanged from before this ticket. This keeps `InstrumentDiscoveryService` entirely out of the interactive run path (decision 3) while leaving the legacy path's behavior byte-for-byte the same.
  - `refreshSymbolCacheInteractively(options, vaultService)` — wired to the picker's `onUpdateSymbolList` callback. Resolves its own credentials/login/discovery (the picker runs before the main run's credentials are resolved) and mutates `options.username`/`options.password` in place so the main `resolveCredentials()` call right after the picker doesn't prompt a second time.
  - `buildIolServices(options, credentials, logger)` — extracted during code review (Standards axis flagged the `AuthService`/`IolHttpClient`/`InstrumentDiscoveryService` construction being duplicated between `main()` and `refreshSymbolCacheInteractively`); now both share one helper.
- `README.md` (ES+EN): Easy Mode steps updated to describe last-selection prompt → picker → format step → masked credentials; `--interactive`/`--instrumentos`/`--formato` parameter descriptions updated to note that supplying `--instrumentos`/`--formato` skips the interactive menu.
- Tests: `test/appRunner.instrumentSelection.test.js` (new) unit-tests `shouldUseInteractiveMenu`, `formatTokenToFormatos`, and `buildInstrumentTargetsFromSelection` directly — per the ticket's own acceptance note, the interactive-picker path itself isn't practical to drive via `spawnSync` (no real TTY), so this is the substitute coverage. `test/cli/cli.test.js` got one new regression test confirming `--instrumentos`/`--formato` still take the direct/legacy path (no picker, no symbol-cache requirement) when passed alongside `--interactive=false`.
- Verified via `mattpocock-skills:code-review` (Standards + Spec axes). Spec axis found **no issues** — every acceptance criterion and the full runtime order checked out. Standards axis flagged the duplicated service-construction (fixed, see `buildIolServices` above) and noted the `mercado: null, panel: null` cache-derived symbol records diverge from the legacy discovery path's populated values — not a bug (the symbol cache never captured `mercado`/`panel`, a pre-existing ticket-03 gap; `aggregationService` already has market-guessing fallbacks for exactly this case), just worth knowing about if `mercado`/`panel`-dependent behavior is ever extended.
- `npm test`: 113/113 passing (was 101 after ticket 05).
- Manually smoke-tested the legacy/direct path end-to-end in a scratch directory (`node src/appRunner.js --interactive=false [...]` and with `--instrumentos`/`--formato` added) — confirmed it reaches the real network call and fails there (expected, no real IOL credentials in this sandbox), not on any of the new wiring logic.
- **Not done — needs the user**: a full manual run with real IOL credentials, per the ticket's acceptance criterion ("A full manual run (real IOL login) exercises: last-selection prompt, picker ..., format step, masked credential prompt, and a successful CSV/XLSX export"). This sandbox has no real IOL account/network access to BYMA/IOL's API, so this step — plus the still-outstanding ticket 04 manual verification of the "Update symbol list" reopen-with-fresh-data path against a real login — remains for the user to do locally.

This was the last ticket in the interactive-menu-redesign plan (01-08 all done). See `../handoff.md` for the cross-ticket summary and remaining commit decision.
