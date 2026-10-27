# Tic Tac Toe

A mobile-first Tic Tac Toe game that feels like a game app. Plain HTML, CSS and
vanilla JavaScript (ES modules). **No framework and no build step.** It installs as a
PWA and works offline.

Made by **Sussal Productions**.

## Features

- **Modes:** vs Computer (Easy, Medium, Hard) and vs Player (same phone)
- **Boards:** 3x3 to 12x12. Win rule: 3x3 = 3 in a row, 4x4 to 6x6 = 4, 7x7 to 12x12 = 5
- **AI:** unbeatable minimax on 3x3; alpha-beta search with a threat-aware heuristic on
  bigger boards. 9x9 and up run in a Web Worker, so the screen never freezes
- **Campaign:** 200 levels in 10 chapters, stars, boss levels, move limits, move timers
- **Move timer:** Off / 10s / 20s / 30s, with a countdown ring around the active player.
  It pauses in the background, while settings are open and while the AI thinks
- **Fair starts:** the player starts the first round, then the starter alternates
- **Coins and shop:** rewards, daily login streak, hints, undos, board themes, X/O skins, avatars
- **Profile:** level and XP, titles, stats per mode, win-rate ring, achievements
- **Big boards:** pinch to zoom, pan and double-tap to reset (9x9 and up), always whole cells
- **Look and feel:** light / dark theme (auto by time of day or manual), sounds made with
  Web Audio, vibration, reduced-motion support
- **Saves:** localStorage with versioned data, migrations and an export / import code

## Folder structure

```
index.html            app shell: top bar, page container, bottom nav
manifest.json         PWA manifest
sw.js                 service worker (offline cache)
vercel.json           headers for Vercel
package.json          only used to run the tests (no dependencies)
assets/
  icons/              app icons (192, 512, maskable) and favicon
  images/             chapter art (avatars use Lucide icons)
  sounds/             empty: sounds are generated with Web Audio
css/
  main.css            imports every CSS file in order
  base/               variables (tokens, themes), reset, typography, layout
  components/         buttons, cards, segmented, bottom nav, sheets, modals, timer, toast
  pages/              home, levels, game, profile, shop
js/
  main.js             entry: storage, theme, router, service worker
  router.js           hash router: #/home #/levels #/game #/profile #/shop #/settings
  config/             constants, level generator (200 levels), shop items
  core/               pure logic, no DOM: board, rules, ai, ai.worker, timer
  services/           storage, economy, progress, stats, achievements, audio,
                      haptics, theme, ai-runner
  components/         bottom nav, sheet, modal, toast, coin counter, timer ring,
                      board view, confetti, level popup
  pages/              home, levels, game, profile, shop, settings (each has mount / unmount)
  utils/              dom, format, validate, events, icons (bundled Lucide subset)
tests/                rules, ai, levels and timer tests (Node test runner)
```

Rules the code follows:

- `core/` never touches the DOM, so it runs in the browser, in a worker and in Node tests.
- `pages/` only render UI and call services. Each page exports `mount()` and `unmount()`,
  and `unmount()` removes its listeners, timers and popups.
- HTML has no inline styles and no inline scripts.

## Run locally

ES modules need a web server (opening `index.html` from disk does not work).

```bash
# any static server works, for example:
python3 -m http.server 5173
# or
npx serve -l 5173 .
```

Then open <http://localhost:5173>.

Run the tests (Node 18 or newer, no install needed):

```bash
npm test
```

## Deploy on Vercel

1. Push the repository to GitHub.
2. In Vercel, click **Add New > Project** and import the repository.
3. Framework preset: **Other**. Leave the build command and output directory empty
   (the site is served as-is from the repository root).
4. Click **Deploy**.

`vercel.json` makes sure `sw.js` is never cached by the browser, so updates reach players.
When you change any app file, bump `CACHE` in `sw.js` (for example `ttt-v2`) so installed
copies download the new version. If you add or rename files, add them to `APP_FILES` too.

## Save data

Two localStorage keys, kept compatible with earlier versions of the game:

| Key | Holds |
|---|---|
| `ttt.v3` | settings, home choices, player names, scores per board |
| `ttt_save_v1` | coins, XP, levels and stars, items, stats, achievements, daily streak |

`ttt_save_v1` has a `version` field. Old saves go through `migrate()` in
`js/services/storage.js`, and any broken field falls back to a safe default.
Players can copy an export code in **Settings > Progress backup** and paste it back later.

## Credits

Icons: [Lucide](https://lucide.dev) (ISC licence), bundled in `js/utils/icons.js`.
Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) from Google Fonts.
