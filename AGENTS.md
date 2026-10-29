# Repository Guidelines

## Project Structure & Module Organization

Web Dashers is a static Phaser browser game. The main entry pages are `index.html` and `test.html`; runtime code is in `assets/scripts/`, with core gameplay in `assets/scripts/core/`, game data in `assets/scripts/game/`, and API/account helpers in `assets/scripts/api/`. Art, spritesheets, fonts, music, sound effects, levels, and generated assets live in the corresponding subdirectories of `assets/`. Branding files are under `wd_branding/`. The `db/` directory contains local project data and should be handled carefully.

## Build, Test, and Development Commands

- `npm start` — serves the repository locally using `npx serve .`.
- `node --check assets/scripts/core/game-scene.js` — checks syntax for the main scene.
- `node --check assets/scripts/core/level-editor.js` — checks syntax for editor changes.
- `git diff --check` — catches whitespace errors before committing.

There is no configured build pipeline or automated test suite. For gameplay changes, run the local server and manually exercise the affected menu, editor, and level flows in a browser.

## Coding Style & Naming Conventions

Use JavaScript with the existing four-space indentation and semicolon style. Preserve the project’s Phaser 3 patterns: create UI with Phaser containers, images, text, and interactive game objects, and clean up listeners and containers when menus close. Use camelCase for local variables and methods; retain existing underscore-prefixed private methods such as `_openSettingsPopup`. New UI must match the existing Geometry Dash-style Phaser interface. Do not introduce `prompt()`, `alert()`, or `confirm()`; use native Phaser controls and dialogs instead.

## Testing Guidelines

At minimum, run `node --check` on every modified JavaScript file and `git diff --check`. Manually test the complete user flow affected by a change, including opening and closing menus, saving, and returning to gameplay. Record reproduction steps for bugs and avoid claiming browser verification when only static checks were run.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects describing one focused change, for example `Move fast reset to global options`. Pull requests should explain the behavior change, list validation performed, link related issues when applicable, and include screenshots or a short recording for visible UI changes. Keep unrelated generated assets and refactors out of focused changes.

## Security & Configuration Tips

Do not commit credentials, account data, or secrets. Treat server/API changes as separate from frontend changes, validate user-provided data at the server boundary, and avoid exposing administrative actions through client-only checks.
