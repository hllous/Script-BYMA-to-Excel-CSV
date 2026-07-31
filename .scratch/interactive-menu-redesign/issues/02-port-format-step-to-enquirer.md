# 02 - Add enquirer, port "Formato de salida" step

Blocked by: (none)

## What

Add `enquirer` as a dependency. Create the new Node-based interactive menu entry point (e.g. `src/interactiveMenu.js`) and port the "Formato de salida" step (CSV+XLSX / CSV only / XLSX only) into it as an `enquirer` `Select` prompt, same 3 options and meaning as today's batch `choice` step.

This is deliberately the smallest, lowest-risk slice — it validates that `enquirer` works correctly in this Windows/Node environment (raw-mode terminal input, `run.bat`-spawned `node` process) before building the much bigger symbol picker on top of it.

## Why

See `../spec.md` decision 5, and decision 8 (menu logic moving into Node). Confirms the UI library choice made in the grilling session works end-to-end before more is built on it.

## Acceptance

- New `src/interactiveMenu.js` (or similar) exists, exports a function that prompts for output format via `enquirer` and returns `"both"|"csv"|"xlsx"`.
- Manually verified working in a real Windows terminal (arrow keys / enter select correctly, no leftover ANSI artifacts).
- Not yet wired into `run.bat` or `appRunner.js` — this ticket only proves the mechanism works. Wiring happens in ticket 08.

## Comments

- Done: added `enquirer` dependency, created `src/interactiveMenu.js` exporting `promptForOutputFormat()` — an `enquirer` `Select` with the same 3 choices (`both`/`csv`/`xlsx`). Smoke-tested by running it directly with `node -e`; renders a clean 3-option list with correct ANSI cursor handling, no artifacts. Full arrow-key/enter interactive verification in a real terminal window still needs a human (sandboxed tool environment has no real TTY). Not yet wired into `run.bat`/`appRunner.js` (per scope — that's ticket 08). 67-test suite still green.
