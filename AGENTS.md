# Repository Guidelines

## Project Structure & Module Organization

Web Dashers is a static Phaser browser game. Entry pages are `index.html` and `test.html`. Runtime code is under `assets/scripts/`:

- `assets/scripts/core/` — scenes, player physics, levels, and the editor.
- `assets/scripts/game/` — game data and definitions.
- `assets/scripts/api/` — account and server helpers.
- `assets/` — spritesheets, fonts, music, sound effects, backgrounds, and level data.
- `db/` — local project data; handle carefully.
- `wd_branding/` — branding assets.

`game-scene.js` owns the main scene and menus; `player.js` handles physics; `level.js` stores collision geometry; and `level-editor.js` handles editing and playtesting.

## Build, Test, and Development Commands

- `npm start` — serve locally with `npx serve .`.
- `node --check assets/scripts/core/game-scene.js` — check scene syntax.
- `node --check assets/scripts/core/player.js` — check physics syntax.
- `node --check assets/scripts/core/level-editor.js` — check editor syntax.
- `git diff --check` — detect whitespace errors.

There is no configured build pipeline or automated test suite. Run the local server and manually test affected menus, editor flows, saving, and gameplay in a browser. Refresh after script changes.

## Coding Style & Naming Conventions

Use JavaScript with four-space indentation, semicolons, and camelCase names. Preserve underscore-prefixed private methods such as `_openSettingsPopup`. Build UI with native Phaser objects and match the existing Geometry Dash-style interface. Never use `prompt()`, `alert()`, or `confirm()`; use Phaser dialogs and controls.

## Testing Guidelines

Run `node --check` for every modified JavaScript file and `git diff --check`. Test complete affected flows, including menu close behavior, editor save/load, normal and practice play, gravity-flipped play, and dual mode when relevant. Do not claim browser verification based only on static checks.

## Commit & Pull Request Guidelines

Use short, imperative subjects for one focused change, e.g. `Move fast reset to global options`. PRs should explain behavior changes, list validation, link issues when applicable, and include screenshots or recordings for visible UI changes.

## Security & Change Workflow

Never commit credentials, account data, or secrets. Validate input at server boundaries and do not rely on client-only administrative checks. Inspect `git diff`, preserve unrelated worktree changes, and never use destructive reset commands without explicit approval.
