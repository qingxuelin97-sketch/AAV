# 🍄 Super Mario — Full-Stack Platformer

A complete Super Mario-style platformer built from scratch: a hand-written
HTML5 Canvas game engine on the front end and a Node/Express backend serving a
persistent global leaderboard. **No game art, sprite sheets, or audio files** —
every visual is drawn with canvas primitives and every sound is synthesized with
the Web Audio API, so the whole thing is self-contained.

![levels](https://img.shields.io/badge/levels-10%20%2B%203%20bosses-e52521) ![tests](https://img.shields.io/badge/tests-103%20passing-5fe06b)

## Features

### Gameplay
- **Four live-sequenced soundtracks** 🎵 — the iconic overworld theme (sped up
  during star power), a gentle **snow** theme, a moody **night/underground**
  theme, and a dark, driving **boss theme**, each chosen by the level — plus
  full level-clear / game-over / death / flagpole / boss-defeat jingles. All
  synthesized with the Web Audio API — no audio files.
- **Game feel & polish** — squash-and-stretch, landing/running dust, a
  smooth look-ahead camera, screen shake on big impacts, and soft ground
  shadows, on top of redrawn, shaded character art.
- **Snappy platforming physics** — acceleration/friction, run vs. walk speeds,
  variable jump height, skid turns, faster run-jumps, plus *coyote time* and
  *jump buffering* for a forgiving, modern feel.
- **Chinese UI** with a **level-select menu** (levels unlock as you clear them,
  saved in your browser).
- **10 hand-designed levels** across day, dusk, night, **snow**, **cave** and
  **castle** themes (with falling snow, glowing crystals and bubbling lava),
  each ending in a flagpole + fireworks. Difficulty **ramps** from a gentle
  World 1 to a punishing World 3 (more pits, Spinies and enemy gauntlets), yet
  **every level is automatically verified completable** by a headless auto-pilot
  in the tests, so no stage can ship un-runnable.
- **Three detailed, multi-attack bosses** — a mid-game **Hammer King** (lobs
  arcing hammers), a fast, single-phase **Shadow Bowser** fortress guardian, and
  a final **two-phase Bowser** (6 HP × 2). Each telegraphs then picks from
  several moves: **fire stream**, **3-way spread**, **leaping ground slam** (with
  shockwaves), and a **rushing charge** — and rages faster in phase 2. Beat them
  with projectiles or the bridge **axe**; stomping fails.
- **Clear item roles** (each shows a tooltip when picked up):
  - 🍄 **Mushroom** — grow / take an extra hit (or stash a spare).
  - 🌸 **Fire** — fireballs, your main **damage** vs. bosses.
  - 🧊 **Ice** — iceballs **freeze** enemies into coin-dropping blocks, and
    **stun the boss** to open a window — control, not damage.
  - ⭐ **Star** — invincibility that blasts through (and damages bosses).
- **Reserve item box** — every level starts with a spare 🍄 you can deploy any
  time with `C`; spare power-ups you grab get stashed there too.
- **Power-ups** — Super Mushroom (grow), **Fire Flower** (bouncing fireballs),
  **Ice Flower** (iceballs that freeze enemies into shatterable blocks),
  **Super Star** (rainbow invincibility), 1-Up Mushroom, and the reserve box.
- **On-screen key feedback** — the control chips light up as you press, on top
  of forgiving coyote-time + jump-buffering input.
- **Enemies** — Goombas, Koopa Troopas with full shell mechanics (stomp → kick
  → spinning shell combos), **Piranha Plants** that rise from pipes and duck
  when you stand near, and spiked **Spinies** that **can't be stomped** — leap
  them, or take them out with a fireball, an iceball, a kicked shell or a star.
- **Interactive blocks** — `?` blocks (coins / mushroom→fire / ice / star /
  1-up), breakable bricks (when powered up) with flying debris, animated coins.
- **Scoring** — stomps, shell kicks, projectile kills, coins, bricks,
  flag-height bonus, boss bonus and a remaining-time tally. 100 coins = 1-Up.
- **Lives, timer, pause, mute**, pit/time-out deaths, level transitions and a
  win screen after beating Bowser.

### Presentation
- Parallax skies, hills and clouds; a procedurally drawn moon and stars at night.
- Pixel-styled HUD and CRT-flavored UI with the *Press Start 2P* font.
- Responsive layout with on-screen touch controls for mobile.

### Backend
- **Express** static server + JSON REST API for the leaderboard.
- Scores validated and sanitized server-side; writes are serialized to avoid
  file corruption; top-100 are persisted to `data/leaderboard.json`.

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` / `A` `D` |
| Jump | `Z` / `Space` / `↑` / `W` |
| Run / Throw fire-or-iceball | `X` / `Shift` |
| Use reserve item | `C` / `↓` |
| Pause | `P` |
| Mute | `M` |

On touch devices, on-screen buttons appear automatically.

## Running it

```bash
npm install
npm start          # serves the game at http://localhost:3000
# or: npm run dev  (auto-restart on changes)
```

Then open <http://localhost:3000>.

## Tests

```bash
npm test
```

103 tests cover level integrity, collision/physics edge cases (gravity, walls,
pits, growing/shrinking, enemy ledge-turning), power-ups (fire/ice/star/reserve),
enemy behaviours (incl. the un-stompable **Spiny**), the boss fights (phases,
axe, fire-breath), a headless run of the full game loop — and, crucially, an
**auto-pilot that proves every non-boss level is actually completable** (it runs
and jumps through each level using the real physics; any level it can't clear
fails CI).

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET`  | `/api/leaderboard?limit=N` | Top N scores (default 10, max 100), sorted by score then time. |
| `POST` | `/api/leaderboard` | Submit a score. Body: `{ name, score, level, coins, timeMs }`. Returns the saved entry + rank. |
| `GET`  | `/api/health` | Health check. |

## Project structure

```
server.js                # Express server + leaderboard API
data/leaderboard.json     # persisted scores
public/
  index.html              # game shell + HUD + overlays
  css/style.css           # pixel-art styling, responsive layout
  js/
    main.js               # boot: wires UI, overlays, HUD, leaderboard
    game.js               # Game: state machine, loop, camera, scoring
    world.js              # tile grid, solidity, block bumps
    entities.js           # Player, Goomba, Koopa, Mushroom, particles + physics
    render.js             # backgrounds + tile/scenery rendering
    sprites.js            # procedural sprite drawing (no image assets)
    levels.js             # programmatic level builder + 3 levels
    input.js              # keyboard + touch input
    audio.js              # Web Audio sound effects + music
    api.js                # leaderboard fetch/submit client
    constants.js          # physics tuning + tile legend
tests/                    # node:test suites
```

## Architecture notes

- **Fixed-timestep-ish loop** with a `dt` clamp to prevent tunneling after stalls.
- **Axis-separated AABB-vs-tile collision** using half-open boxes with an epsilon,
  plus a dedicated ground probe so a body resting flush on a surface stays
  grounded without jitter.
- Levels are generated by a small `LevelBuilder` (ground, pipes, stairs, coins,
  enemies, flag), guaranteeing consistent tile alignment.
- Rendering, input, audio, world and entities are decoupled modules; the UI talks
  to the game only through hooks.

Built with HTML5 Canvas + Node/Express.
