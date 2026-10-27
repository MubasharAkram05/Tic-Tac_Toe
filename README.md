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
- **Campaign:** 500 levels in 10 chapters (3x3 up to 12x12), stars, a boss every 10th level,
  move limits. The levels map is virtualized, so only the nodes near the screen are drawn
- **Move timer:** on by default in every mode (turn it off in Settings). Time per move
  depends on the board size and difficulty (see below). Countdown ring around the active
  player, green / amber / red, pulse + tick in the last 5 seconds. A timeout plays a random
  move. It pauses in the background, while settings are open and while the AI thinks
- **Fair starts:** the player starts the first round, then the starter alternates
- **Coins:** level rewards, daily login streak, hints, undos, board themes, X/O skins, avatars
- **Diamonds:** a rare premium currency (see below), shown next to coins in the top bar
- **Shop:** two tabs, Coins and Diamonds. Diamond buys are confirmed in a small bottom sheet
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
  config/             constants, timers (move times), level generator (500 levels), shop items
  core/               pure logic, no DOM: board, rules, ai, ai.worker, timer
  services/           storage, economy, progress, stats, achievements, audio,
                      haptics, theme, ai-runner
  components/         bottom nav, sheet, modal, toast, currency bar (coins + diamonds),
                      confirm sheet, timer ring, board view, confetti, level popup
  pages/              home, levels, game, profile, shop, settings (each has mount / unmount)
  utils/              dom, format, validate, events, icons (bundled Lucide subset)
tests/                rules, ai, levels, timers, timer and storage tests (Node test runner)
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

## Move timer

All numbers live in `js/config/timers.js`. Time per move = base time x multiplier,
rounded to whole seconds, never below 7s.

| Grid | 3x3 | 4x4 | 5x5 | 6x6 | 7x7 | 8x8 | 9x9 | 10x10 | 11x11 | 12x12 |
|---|---|---|---|---|---|---|---|---|---|---|
| Base (Medium) | 10s | 12s | 14s | 16s | 18s | 20s | 22s | 24s | 27s | 30s |

| Mode | Multiplier |
|---|---|
| vs Computer | Easy x1.5, Medium x1.0, Hard x0.7 |
| vs Player | x1.0 (Medium) |
| Levels | x1.5 on the first level of a chapter, down step by step to x0.8 on the last normal level |
| Boss levels | x0.7 |

Examples: 3x3 Easy 15s, Medium 10s, Hard 7s. 12x12 Easy 45s, Medium 30s, Hard 21s.
In levels a timeout removes the 3-star chance. A diamond buys +10s once per game.

## Campaign

| Chapter | Levels | Grid | Win | Name |
|---|---|---|---|---|
| 1 | 1-20 | 3x3 | 3 | Warm Up |
| 2 | 21-50 | 4x4 | 4 | First Steps |
| 3 | 51-90 | 5x5 | 4 | Getting Smart |
| 4 | 91-140 | 6x6 | 4 | Tactician |
| 5 | 141-195 | 7x7 | 5 | Big League |
| 6 | 196-250 | 8x8 | 5 | Strategist |
| 7 | 251-305 | 9x9 | 5 | Mastermind |
| 8 | 306-360 | 10x10 | 5 | Grandmaster |
| 9 | 361-430 | 11x11 | 5 | Legend |
| 10 | 431-500 | 12x12 | 5 | Ultimate |

Inside a chapter the AI skill rises from 40% to 90% (85% on 3x3, never perfect). The player
starts the early levels; later the AI starts every other level. Every 10th level is a boss
with the chapter's top skill, AI first and x0.7 time.

## Coins and diamonds

| Coins | |
|---|---|
| First clear | 10 + floor(level / 10) |
| New star | +5 each |
| Boss first clear | x3 |
| Replay of a cleared level | 2 |

| Earn diamonds | |
|---|---|
| Boss first clear | +1 (+2 from chapter 6) |
| 3 stars on every level of a chapter | +5 |
| Every level of a chapter cleared | +3 |
| Player level up | +1 |
| Daily reward, every 7th day in a row | +2 |
| Some achievements | +1 to +5 |

| Spend diamonds | |
|---|---|
| +10 seconds on the current move | 1 (once per game) |
| Continue a lost level (takes back the last 2 moves) | 2 (once per try, no 3rd star) |
| Skip a level (gives 1 star, no coins) | 5 (once per chapter) |
| Premium boards, animated skins, legendary avatars | 10-50 |
| Exchange for coins | 1 diamond = 100 coins (one way) |

A skipped level can be won later for its full first-clear reward.

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

Two localStorage keys:

| Key | Holds |
|---|---|
| `ttt.v3` | settings, home choices, player names, scores per board |
| `ttt_save_v2` | coins, diamonds, XP, levels and stars, skips, items, stats, achievements, daily streak |

The save has a `version` field (now 2). On first load, an old `ttt_save_v1` save is run
through `migrate()` in `js/services/storage.js` and written to `ttt_save_v2` (the v1 key
stays as a backup). Level numbers map 1:1 to the new 500-level table, so every cleared level
and star is kept. Any broken field falls back to a safe default.

Players can copy an export code in **Settings > Progress backup** and paste it back later.
New codes start with `TTT2-`; older `TTT1-` codes still import.

## Credits

Icons: [Lucide](https://lucide.dev) (ISC licence), bundled in `js/utils/icons.js`.
Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) from Google Fonts.
