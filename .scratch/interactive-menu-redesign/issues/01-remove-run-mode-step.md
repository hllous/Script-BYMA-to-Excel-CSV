# 01 - Remove "Modo de corrida" step, fix pagination defaults

Blocked by: (none)

## What

Remove the "Modo de corrida" (Rapida/Completa/Custom) menu step from `run.bat`. `pageSize`/`maxPages`/`concurrency` become fixed defaults matching the old "Completa" preset (100/200/5) — this already matches `DEFAULTS` in `src/config/constants.js`, so no default-value change is needed there, only removal of the menu step and the flags it injected.

## Why

See `../spec.md` decision 1. These are internal HTTP-pagination tuning knobs, not a meaningful user-facing choice.

## Acceptance

- `run.bat`'s interactive menu no longer prompts for run mode.
- The `node src\appRunner.js` invocation inside `run.bat` no longer passes `--pageSize=`/`--maxPages=`/`--concurrency=` (they fall through to `DEFAULTS`).
- `--pageSize`/`--maxPages`/`--concurrency` CLI flags and `config.local.json` fields still work for power users (no change to `argParser.js`/`mergeOptions`).
- Existing tests in `test/utils/argParser.test.js` and `test/services/*` still pass unmodified.

## Comments

- Done: removed the "Modo de corrida" choice block and the PAGESIZE/MAXPAGES/CONCURRENCY prompts/vars from `run.bat`; `node src\appRunner.js` invocation now only passes `--instrumentos`/`--formato`/`--salida`. `DEFAULTS` in `src/config/constants.js` already had 100/200/5, no change needed there. Full 67-test suite still green (`npm test`).
