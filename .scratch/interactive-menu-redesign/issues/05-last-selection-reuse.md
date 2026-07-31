# 05 - Persist and reuse last selection

Blocked by: 04

## What

After a successful run with a picker-driven selection, persist it to a local, gitignored file (e.g. `.last-selection.json`, alongside `config.local.json` in `.gitignore`).

On the next interactive run, before opening the picker, check for this file. If present, prompt yes/no: *"Use last selection ([summary])? [Y/n]"* — the summary collapses fully-selected categories to just the category name, and lists individual tickers only for partially-selected categories.

- **Yes** → skip the picker entirely, proceed straight to credentials/run with the stored selection.
- **No** → open the picker (ticket 04) pre-checked with the stored selection as a starting point.

## Why

See `../spec.md` decision 4.

## Acceptance

- `.last-selection.json` (or chosen name) added to `.gitignore`.
- Summary line correctly distinguishes fully-selected categories (name only) from partial ones (ticker list).
- "Yes" path never invokes the picker UI at all.
- "No" path opens the picker with the previous selection's checkboxes pre-ticked.
- First run (no prior file) skips the yes/no prompt and goes straight to the picker with nothing pre-checked.

## Comments

Implemented this session:

- `src/services/lastSelectionService.js` (new): `LastSelectionService` with `readSelection()`/`writeSelection()`, same shape as `SymbolCacheService` (`readCache`/`writeCache`). Default path `.last-selection.json` at repo root (relative to cwd, matching how `config.local.json` is resolved). Persists the exact `{categories, symbols}` shape ticket 04's `promptForSymbolSelection` returns — no extra fields, no schema versioning (kept minimal, YAGNI).
- `.last-selection.json` added to `.gitignore` alongside `config.local.json`.
- `src/interactiveMenu.js` gained:
  - `formatSelectionSummary(selection)` — fully-selected categories rendered by display name (via `INSTRUMENT_DEFINITIONS`), partially-selected categories rendered as their individual tickers. Joined into one comma-separated string.
  - `promptToReuseLastSelection(summary)` — `enquirer` `Confirm`, styled like `promptToSaveToVault()` in `prompt.js`. **Note**: must pass `initial: true` so the prompt defaults to Yes on bare Enter, matching the spec's `[Y/n]` wording — caught by code review, already fixed.
  - `promptForSymbolSelectionWithReuse({ cache, lastSelectionService, onUpdateSymbolList, promptOverrides, selectSymbols, confirmReuse })` — the orchestration function implementing all 5 acceptance criteria: no prior selection → skip straight to picker; prior selection + Yes → return stored selection, picker never opens; prior selection + No → open picker pre-checked via `initialSelection`. Persists the resulting selection after every picker run. `selectSymbols`/`confirmReuse` are injectable (default to the real `promptForSymbolSelection`/`promptToReuseLastSelection`) purely so the orchestration logic is unit-testable without a real TTY — same DI pattern used throughout this codebase (`SymbolCacheService` takes `authService`/`discoveryService`, etc.).
- Tests: `test/services/lastSelectionService.test.js` (round-trip, overwrite, missing-file cases) and additions to `test/interactiveMenu.symbolPicker.test.js` covering `formatSelectionSummary` (full/partial/mixed) and all three `promptForSymbolSelectionWithReuse` branches via fakes.
- Verified via `mattpocock-skills:code-review` (Standards + Spec axes). Spec axis caught the `initial: true` Confirm-default bug (fixed). Standards axis flagged a missing `mkdirSync` in `writeSelection` for parity with `symbolCacheService.writeCache` (fixed) and noted `promptForSymbolSelectionWithReuse` isn't called anywhere yet — expected, that's ticket 08's job.
- **Design note for ticket 08**: the ticket's "What" section says selection should persist "after a successful run" — as built, `promptForSymbolSelectionWithReuse` persists right after the picker returns, not gated on the run (login/aggregate/export) actually succeeding. This wasn't tested by the acceptance criteria (which don't mention run-success gating) and matches how most CLIs remember "last choice" regardless of what happens after, but ticket 08 should decide deliberately whether that's acceptable or whether persistence needs to move later in the flow.
- `npm test`: 101/101 passing (was 92 before this ticket).
- **Post-08 follow-up**: `promptForSymbolSelectionWithReuse`'s default `selectSymbols` now points to the new `promptForInstrumentSelection` (preset-menu-first flow) instead of directly to `promptForSymbolSelection`, and it gained a `menuOverrides` passthrough param mirroring `promptOverrides`. See `../handoff.md`'s "Post-ticket-08 UX follow-up" section. The reuse/persistence logic itself (this ticket's core contribution) is unchanged.
