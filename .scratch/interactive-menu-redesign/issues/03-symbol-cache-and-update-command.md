# 03 - Symbol cache file + "update symbol list" fetch logic

Blocked by: (none)

## What

Define the local symbol cache file format (e.g. `data/symbols.json`, committed to git) holding, per category key (`acciones`, `cedears`, etc.), the list of symbols `InstrumentDiscoveryService` would otherwise discover live (`simbolo`, `descripcion`, etc.).

Build the fetch-and-write logic: reuses `AuthService` + `IolHttpClient` + `InstrumentDiscoveryService` to run full discovery across all 8 categories, then overwrites the cache file. This is the logic the picker's "Update symbol list" row will call (ticket 04) — build and test it standalone first.

Seed the committed cache file with a real snapshot (run this logic once against the live API to generate initial data).

## Why

See `../spec.md` decisions 2 (update action) and 3 (cache committed to repo). This is the piece that makes the picker's "no wait" requirement possible — decouples symbol data from picker startup time.

## Acceptance

- Cache file format documented (inline comment or short doc), same shape usable by both the seed data and future refreshes.
- A function (e.g. `refreshSymbolCache()`) that logs in, discovers all 8 categories, and writes the cache file — covered by tests using a fake `iolHttpClient`/`authService` (same pattern as `test/services/instrumentDiscoveryService.test.js`), not a real network call.
- `data/symbols.json` (or chosen path) committed with real seed data.
- Cache file is *not* gitignored (deliberately committed, unlike `config.local.json`).

## Comments

- Done: `src/services/symbolCacheService.js` — `SymbolCacheService.refreshSymbolCache()` logs in via injected `authService`, discovers all 8 `INSTRUMENT_DEFINITIONS` categories via injected `discoveryService`, and writes `{ generatedAt, categories: { <key>: [{ simbolo, descripcion }] } }` to `cachePath` (default `data/symbols.json`). `readCache()` reads it back, `null` if missing. Tested with fake auth/discovery services (`test/services/symbolCacheService.test.js`, 6 tests), same pattern as `instrumentDiscoveryService.test.js` — no real network calls in the test suite.
- Seeded `data/symbols.json` with a real snapshot by running a one-off script against the live API using the credentials in `config.local.json` (script discarded after use, not committed). Real counts: acciones 98, cedears 950, letras 32, bonos 195, ons 866, opciones 507. `fci` and `etfs` came back with 0 symbols — the existing `InstrumentDiscoveryService` endpoint candidates don't resolve for those two instrument types against the live API today. This is a pre-existing discovery gap, not something this ticket introduced or is scoped to fix; noting it here as a candidate for a follow-up ticket. Cache file is committed (not gitignored). 73-test suite green.
