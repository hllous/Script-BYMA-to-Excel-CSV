# 06 - Masked credential prompt via enquirer

Blocked by: 02

## What

Replace `src/utils/prompt.js`'s `readline`-based `promptForCredentials` with `enquirer` prompts — username as plain text input, password as a masked (`Password`-type) input.

## Why

See `../spec.md` decision 6. Current prompt echoes the password in plain text on screen.

## Acceptance

- Password characters are not echoed to the terminal during interactive credential entry (shown as `*` or hidden, per `enquirer`'s `Password` prompt).
- `promptForCredentials`'s existing call signature/behavior (username/password fallback logic in `resolveCredentials`, `src/appRunner.js`) is unchanged — only the underlying prompt mechanism changes.
- Existing tests that exercise this path (if any rely on `readline` specifics) updated accordingly; new/updated tests confirm the function still returns `{username, password}` correctly when one or both are pre-supplied.

## Comments

- Done: `src/utils/prompt.js`'s `promptForCredentials` now uses `enquirer`'s `Input`/`Password` prompts instead of `readline`. Call signature and pre-supplied-value fallback behavior (`currentUsername`/`currentPassword`, trimmed) unchanged — `resolveCredentials` in `appRunner.js` needed no changes. Smoke-tested the `Password` prompt renders cleanly (masked input, no ANSI artifacts). Added `test/utils/prompt.test.js` covering the pre-supplied short-circuit path (no prior test existed for this file). 74-test suite green.
