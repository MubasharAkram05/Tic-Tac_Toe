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
  move limits and 9 level twists (coins, ice, gravity, wrap and more, see below). The levels map is
  virtualized, so only the nodes near the screen are drawn
- **Move timer:** on by default in every mode. There is no timer choice in the setup sheets:
  time per move is automatic (see below), and **Settings > Move timer** turns it on or off. Countdown ring around the active
  player, green / amber / red, pulse + tick in the last 5 seconds. A timeout plays a random
  move. It pauses in the background, while settings are open and while the AI thinks
- **Fair starts:** the player starts the first round, then the starter alternates
- **Top bar:** coins and diamonds always show (also at 0), and in a compact form in the game
  bar. Under 10,000 the number is shown in full (9,850), from 10,000 it is short (12.3k, 1.2M)
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
  config/             constants, timers (move times), level generator (500 levels), shop items,
                      level-twists (twist rules), twist-table (generated)
  core/               pure logic, no DOM: board, rules, ai, twist-ai, ai.worker, timer,
                      random, layout-generator, layout-validator
    twists/           rule modules: index (hooks), blocked, preset, coin-cells, ice-cells,
                      line-rule, shrinking, vanishing, gravity, wrap
  services/           storage, economy, progress, stats, achievements, audio,
                      haptics, theme, ai-runner
  components/         bottom nav, sheet, modal, toast, currency bar (coins + diamonds),
                      confirm sheet, timer ring, board view, confetti, level popup, twist tutorial
  pages/              home, levels, game, profile, shop, settings (each has mount / unmount)
  utils/              dom, format, validate, events, seeded-random, icons (bundled Lucide subset)
tools/                gen-twist-table.js (npm run twists), not deployed
tests/                rules, ai, levels, timers, timer, storage, format (Node test runner)
  twists/             one file per twist + layouts (all 500 levels) + AI legality
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

## Level twists

Twists only exist in Levels mode. vs Computer and vs Player boards never change.

| Twist | Icon | What happens | Boards |
|---|---|---|---|
| Coin cells | coins | 1-3 cells hold +5 coins (bosses: +1 diamond). Paid only if you win, first clear only | 4x4+ |
| Vanishing marks | hourglass | Each side keeps 3 / 4 / win length + 2 marks; one more and your oldest fades out. 60 moves = draw | 4x4+ |
| Blocked cells | ban | Stone tiles nobody can play on; they break lines | 5x5+ |
| Ice cells | snowflake | 2-6 frozen cells melt after 4-8 moves (a countdown shows on them) | 5x5+ |
| Line rule | grid / move-diagonal | "Straight only" (rows and columns) or "Diagonal only" (6x6+) | 5x5+ |
| Gravity | arrow-down-to-line | Your mark drops to the lowest free cell of the column, like Connect Four | 5x5+ |
| Puzzle | puzzle | X and O marks start on the board (pinned); win within N moves (2-4) | 8x8+ |
| Wrap-around | repeat | Rows and diagonals continue from the right edge to the left edge (faded ghost columns at the sides) | 8x8+ |
| Shrinking board | shrink | Every 8 moves the empty outer ring is blocked (warning 2 moves before); stops at win length + 2 | 9x9+ |

### Schedule

| Level | New twist (intro) |
|---|---|
| 1-20 | none |
| 25 | Coin cells |
| 41 | Vanishing marks |
| 51 | Blocked cells |
| 71 | Ice cells |
| 101 | Line rule |
| 121 | Gravity |
| 196 | Puzzles |
| 261 | Wrap-around |
| 281 | Shrinking board |
| 300+ | Mixes of all twists |

- The intro level is easy and has only that twist (lowest AI skill, no move limit, you start).
  Intros never sit on a boss level (every 10th), so 40 / 70 / 100 / 120 / 260 became the next
  normal level. Shrinking starts at 281 because it needs a 9x9 board.
- A new twist then shows up in about 20-30% of the next levels; its share drops as more
  twists arrive (12-20% each near the end).
- Max 1 twist on normal levels and 2 on bosses before level 300, then 2 and 3.
- After 3 or 4 twist levels in a row there is always a normal level.
- Never together: gravity + vanishing, gravity + shrinking, vanishing + puzzle, wrap + shrinking.
  Puzzles only mix with blocked cells and coin cells, so "win in N" stays exact.
  All rules live in `js/config/level-twists.js` and the generator follows them.

### How it works

- **Rule modules** (`js/core/twists/`): every twist is a small module with optional hooks:
  `setup(state, layout)`, `isPlayable(state, cell)`, `resolveMove(state, cell)` (gravity),
  `afterMove(state, move, events)` (vanish, melt, shrink, coins), `getLineCells(state, start, dir)`
  (wrap, line rule), `allowsDir(state, dir)` (line rule) and `isDraw(state)` (vanishing cap).
  `index.js` builds a plain, cloneable game state and runs the hooks in a fixed order. With no
  twists every hook falls back to the classic rules, so normal games play exactly as before.
- **Undo** keeps a snapshot of the state before each move, so it reverses everything: vanished
  marks come back, ice re-freezes, rings re-open and coins return.
- **AI** (`js/core/twist-ai.js`) plays through the same hooks, so it never makes an illegal
  move: columns with gravity, the vanishing mark counted, the centre preferred while the board
  shrinks, only valid lines scored, coins as a tiny bonus. Levels with only blocked cells,
  puzzles or coins keep the classic AI. Same 200ms budget, Web Worker on 9x9+, seeded random
  numbers in tests (`js/core/random.js`).
- **Deterministic layouts:** every layout comes from `mulberry32(level + 1000 x attempt)`
  (`js/core/layout-generator.js`). Boss overrides in `js/config/level-twists.js` win.
- **Validated offline, not on the phone:** `npm run twists` checks all 500 levels
  (`js/core/layout-validator.js`) and writes `js/config/twist-table.js` (twists, attempt,
  puzzle length). The game only rebuilds that attempt. Checks: allowed combo and board size,
  no overlapping cells (coins / ice never on blocked cells), 60% of lines open, the level is
  winnable under its rules (gravity: only reachable cells; shrinking: the final area), the
  board never shrinks below win length + 2, no floating marks with gravity, and puzzles are
  fair and forced in exactly N moves. A failing layout tries the next seed (50 attempts), then
  the level plays normally. The tests fail if the table is out of date.
- **UI:** small twist icons in the level popup and on map nodes, chips in the game bar (tap one
  for a one-line explanation, "Straight only", "Shrinks in 2", coins collected), a one-time
  tutorial with a tiny animated demo per twist ("seen" is saved in `ttt.v3`). Animations stay
  under 300ms and stop with reduced motion.
- **Saves:** layouts are not saved. Stars are stored per level number, so if a layout changes
  in a later update, the player keeps the stars they earned.

### Adding a new twist

1. Write `js/core/twists/my-twist.js` with an `id` and the hooks it needs (keep its data on the
   state as plain objects so snapshots and the AI worker can copy it).
2. Register it in `MODULES` and `ORDER` in `js/core/twists/index.js`.
3. In `js/config/level-twists.js`: add it to `TWIST_IDS`, `INTRO`, `MIN_SIZE`, `TWIST_INFO`
   (icon, name, chip, explanation) and `FORBIDDEN` if it clashes with another twist.
4. Build its layout part in `buildLayout()` (`js/core/layout-generator.js`), add a check in
   `validateLayout()`, and a letter in `TWIST_CODES` (`js/config/twist-table.js`).
5. If it changes the rules, teach `js/core/twist-ai.js` about it (and keep it out of the
   classic set in `needsTwistAI`). Draw it in `BoardView.sync()` and add a tutorial.
6. Run `npm run twists`, then add `tests/twists/my-twist.test.js` (hooks, undo, AI legality).

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
