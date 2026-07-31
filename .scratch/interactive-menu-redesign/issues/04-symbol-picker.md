# 04 - Searchable checkbox symbol picker

Blocked by: 02, 03

## What

Build the main picker: a flat, real-time-searchable `enquirer` multi-select list reading from the symbol cache (ticket 03), mixing:

- Category rows (toggle-all-in-category).
- Individual symbol rows (toggle one by one).
- A special "Update symbol list from IOL" row that calls `refreshSymbolCache()` (ticket 03), then reopens the picker with fresh data.

Returns the final selection as a structure distinguishing "fully-selected categories" from "individually-selected symbols" (needed by ticket 05's summary display and ticket 08's aggregation call).

## Why

See `../spec.md` decision 2 — the core of this redesign.

## Acceptance

- Typing filters the list in real time across category names and symbol tickers/descriptions.
- Selecting a category row toggles every symbol under it; individual symbols can be unchecked afterward without affecting the category's other members.
- Selecting individual symbols across multiple categories (without full-category selection) works independently of the category toggle.
- Selecting "Update symbol list from IOL" triggers ticket 03's refresh logic, then re-renders the picker with the updated cache — verified manually (real login) at least once.
- Return shape clearly separates fully-selected categories from ad-hoc individual picks (needed downstream).

## Comments

**Implemented and verified.**

- **Prototype spike first** (per the user's requested order): confirmed via `.scratch/interactive-menu-redesign/picker-spike.js` that plain `enquirer.AutoComplete({ multiple: true, choices: nestedChoices })` already gives category-toggles-children + independently-toggleable children + real-time search, all working together, with **no subclassing/custom keypress handling needed** — `ArrayPrompt.toggle()` (enquirer's own `lib/types/array.js`) natively cascades a parent toggle to its `choices` array and recomputes the parent's `enabled` flag from its children on any child toggle. This de-risked the ticket significantly versus the handoff's assumption that subclassing would be required.
- **Implementation**: `src/interactiveMenu.js` — `promptForSymbolSelection()` plus pure helpers `buildSymbolPickerChoices`, `buildSymbolSelectionShape`, `selectionToInitialNames`, `symbolChoiceName`. Category rows are built as `enquirer` parent choices with nested `choices` (one per symbol, named `${categoryKey}::${simbolo}` to keep names unique across categories). The "Update symbol list from IOL" row is a flat sibling choice (`UPDATE_SYMBOL_LIST_CHOICE`); if it ends up enabled at submit time, `onUpdateSymbolList()` (injected by the caller — will be wired to `SymbolCacheService.refreshSymbolCache()` + credentials in ticket 08) is awaited and the picker recurses with the fresh cache, carrying the in-progress selection forward as `initial`.
- **Return shape**: `{ categories: string[], symbols: { category, simbolo }[] }` — a fully-enabled category contributes to `categories`; a partially-enabled one contributes its enabled children to `symbols`. Matches what tickets 05/08 need.
- **Bug found and fixed via code review** (spec-axis sub-agent, see handoff): the initial implementation read `prompt.choices` to build the final shape, but enquirer's `AutoComplete` narrows `.choices` to the currently-filtered subset while a search is active — submitting without clearing the filter would silently drop out-of-filter selections. Fixed by reading `prompt.state._choices` (enquirer's full, never-filtered accumulator), filtered to top-level entries, instead.
- **Testing**: `test/interactiveMenu.symbolPicker.test.js` (9 cases) covers all the pure logic — choice building, category-empty filtering, initial-selection expansion, and the category/individual split in all combinations, including the "update requested" flag. Full suite: **92/92 passing**.
- **Manual/smoke verification** (no real TTY in this sandbox, so this isn't part of the automated suite — see `.scratch/interactive-menu-redesign/picker-smoke.js`, not committed): drove the real `promptForSymbolSelection()` against the real seeded `data/symbols.json` via synthetic keypresses. Verified: real-time search narrows correctly across category+symbol names; category toggle cascades to children and back-propagates partial state; individual picks across categories work independently; "Update symbol list" reopens with fresh cache data (confirmed a synthetically-added symbol appears) while preserving the in-progress selection; and the filtered-submit regression scenario (the bug above) now returns the correct shape.
- **Not yet manually verified with a real IOL login** — the acceptance criterion "verified manually (real login) at least once" for the update-and-reopen path was only exercised with a faked `onUpdateSymbolList` callback (real login wiring doesn't exist until ticket 08). Flag this for a manual pass once 08 wires real credentials/discovery into the callback.
- A small test-only seam was added to support all of the above: `promptForSymbolSelection` accepts an optional `promptOverrides` object shallow-merged into the `AutoComplete` constructor options (used by the smoke script to inject fake `stdin`/`stdout` and an `onRun` hook — a stock enquirer hook, not a custom addition). No behavior change for real callers who omit it.
- **Post-08 follow-up, real login now verified**: this picker's message/footer were reworded (instructions moved from the inline `message` to enquirer's `footer` option) and it's no longer the *first* screen shown — a new preset menu (`promptForInstrumentPresetMenu`) now runs first, only dropping into this picker via its "Custom" option. See `../handoff.md`'s "Post-ticket-08 UX follow-up" section for the full writeup. Also: a real end-to-end smoke test with real IOL credentials confirmed login + cache-only aggregation + export all work (see handoff's "Real-login manual verification" section) — the "Update symbol list" reopen path specifically is still only faked/unverified against a real login, as noted above.
