# Spec: Interactive menu redesign

## Why

The current `run.bat` menu has a "Modo de corrida" (run mode: Rapida/Completa/Custom) step that exposes internal HTTP pagination tuning (`pageSize`/`maxPages`/`concurrency`) as a user-facing choice — this doesn't make sense to the user and is being removed. While redesigning that step, the "Custom (lista manual)" instrument selection (free-text comma-separated category names) was also identified as poor UX, and the redesign grew to cover a full symbol-level, searchable, checkbox-based picker plus several related gaps found along the way (unmasked password prompt, plain-text stored password, no local symbol cache).

This spec is the output of a `/grilling` interview; see conversation history for the full back-and-forth. It reflects final, confirmed decisions — no open questions remain.

## Decisions

1. **Remove "Modo de corrida" entirely.** `pageSize`/`maxPages`/`concurrency` become fixed internal defaults matching the old "Completa" preset (100/200/5). Still overridable via `config.local.json`/CLI flags, never prompted for.

2. **Symbol-level searchable picker**, via `enquirer`, replaces both the old "Instrumento" step and "Custom lista manual":
   - One flat, real-time-searchable checkbox list.
   - **Category rows** act as toggle-all-in-category shortcuts (toggling "Acciones" checks/unchecks every symbol under it; individual symbols can still be adjusted after).
   - **Individual symbol rows** are toggleable one by one, across any combination of categories.
   - A special **"Update symbol list from IOL"** row triggers login + full discovery + overwrites the local symbol cache, then reopens the picker with fresh data. This is the *only* place a live discovery API call happens in the new design.

3. **Local symbol cache**, committed to the repo (seeded snapshot), read instantly by the picker — no live API call, no login, no wait on a normal run. Refreshed only via the picker's "Update symbol list" action (decision 2).

4. **Last-selection reuse.** The previous custom selection is persisted locally (gitignored, like `config.local.json`). On next run, before the picker, prompt: *"Use last selection ([category names for fully-selected categories], [individual tickers for partially-selected ones])? [Y/n]"*
   - **Yes** → skip the picker entirely, go straight to credentials/run with that list.
   - **No** → open the picker, pre-checked with the previous selection as a starting point.

5. **Formato de salida** (CSV+XLSX / CSV only / XLSX only) is ported as-is, same 3 options and meaning, just as an `enquirer` `Select` instead of batch `choice`.

6. **Credential prompt** moves to `enquirer` with masked password input (current `readline`-based prompt in `src/utils/prompt.js` echoes the password in plain text).

7. **Credential storage.** Password moves out of `config.local.json` plain text into the OS credential store (Windows Credential Manager, via `keytar` or `@napi-rs/keyring`). Username may remain in `config.local.json`; password is looked up from the secure vault at runtime.

8. **`run.bat` becomes a thin wrapper**: install deps if missing, then invoke the new Node-based interactive menu. All `choice`/`set /p` menu logic moves out of batch into Node.

## New runtime order

Picker (instant, cache-only, no login) → resolve credentials (prompt/vault/config, masked) → login → aggregate quotes for only the selected symbols → CCL calc → export.

Discovery (`InstrumentDiscoveryService`) is no longer part of the normal run path — it only runs from the picker's "Update symbol list" action.

## Out of scope

- Changing the CCL-suffix heuristic bug noted during the earlier CLI walkthrough (options tickers ending in `C` risk false-positive pairing) — separate concern, not part of this redesign.
- Any change to the export formats (CSV/XLSX schema) themselves.
- Non-Windows support for the credential vault (this tool is Windows-only via `run.bat`).
