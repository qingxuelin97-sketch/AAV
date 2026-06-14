// Level definitions. Levels are built programmatically with a small builder so
// tile alignment is always correct, then exposed as arrays of row strings.
//
// Design rules (kept gentle on purpose, and verified by tests/solvable.test.js
// which runs an auto-pilot through every non-boss level):
//   * the main path is continuous ground with pits no wider than 3 tiles
//   * pipes/walls are at most 3 tiles tall so a single jump always clears them
//   * stairs and floating platforms are optional bonus routes, never the only way
//   * the run up to each pit and to the flag is flat

import { T, ROWS } from "./constants.js";

class LevelBuilder {
  constructor(width, height = ROWS) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => new Array(width).fill(T.EMPTY));
  }
  set(col, row, ch) {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;
    this.grid[row][col] = ch;
  }
  hline(row, from, to, ch) {
    for (let c = from; c <= to; c++) this.set(c, row, ch);
  }
  ground(from, to, topRow = this.height - 2) {
    for (let r = topRow; r < this.height; r++) this.hline(r, from, to, T.GROUND);
  }
  // Cut a pit `len` tiles wide starting at `col`.
  pit(col, len) {
    for (let r = this.height - 2; r < this.height; r++) this.hline(r, col, col + len - 1, T.EMPTY);
  }
  pipe(col, heightTiles, piranha = false) {
    const topRow = this.height - 2 - heightTiles;
    this.set(col, topRow, T.PIPE_TL);
    this.set(col + 1, topRow, T.PIPE_TR);
    for (let r = topRow + 1; r < this.height - 2; r++) {
      this.set(col, r, T.PIPE_BL);
      this.set(col + 1, r, T.PIPE_BR);
    }
    if (piranha) this.set(col, topRow - 1, T.PIRANHA);
  }
  // Short bonus staircase (3 steps) — never blocks the main flat path.
  steps(startCol, n = 3, dir = 1) {
    for (let i = 0; i < n; i++) {
      const col = startCol + i * dir;
      for (let h = 0; h <= i; h++) this.set(col, this.height - 3 - h, T.HARD);
    }
  }
  coins(row, from, to, step = 1) {
    for (let c = from; c <= to; c += step) this.set(c, row, T.COIN);
  }
  flag(col) {
    for (let r = 3; r <= this.height - 3; r++) this.set(col, r, T.FLAGPOLE);
    this.set(col, this.height - 2, T.FLAGBASE);
    return col;
  }
  toRows() {
    return this.grid.map((row) => row.join(""));
  }
}

// ---------------------------------------------------------------------------
// World 1-1 — gentle introduction.
// ---------------------------------------------------------------------------
function world1() {
  const w = 170;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  b.pit(40, 2);
  b.pit(70, 3);
  b.pit(120, 2);

  b.set(14, 9, T.QBLOCK_COIN);
  b.set(18, 9, T.BRICK);
  b.set(19, 9, T.QBLOCK_MUSH);
  b.set(20, 9, T.BRICK);
  b.coins(9, 22, 26);

  b.set(30, 12, T.GOOMBA);
  b.pipe(34, 2);
  b.pipe(50, 3, true);
  b.set(58, 12, T.GOOMBA);
  b.set(59, 12, T.GOOMBA);

  b.coins(8, 70, 72); // arc over the pit
  b.set(80, 9, T.QBLOCK_COIN);
  b.set(82, 9, T.QBLOCK_STAR);
  b.set(84, 9, T.QBLOCK_COIN);

  b.set(92, 12, T.KOOPA);
  b.pipe(100, 2);
  b.set(108, 12, T.GOOMBA);
  b.set(112, 9, T.QBLOCK_1UP);

  b.set(140, 12, T.GOOMBA);
  b.coins(9, 145, 150);

  return { name: "1-1", time: 400, bg: "day", flagCol: b.flag(160), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 1-2 — dusk, a few more enemies and pipes.
// ---------------------------------------------------------------------------
function world2() {
  const w = 178;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [25, 55, 88, 120, 145].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.coins(9, 11, 15);
  b.set(18, 12, T.GOOMBA);

  b.pipe(33, 2, true);
  b.set(40, 9, T.QBLOCK_MUSH);
  b.set(46, 12, T.GOOMBA);
  b.set(48, 12, T.GOOMBA);

  b.set(62, 9, T.QBLOCK_COIN);
  b.set(64, 9, T.QBLOCK_ICE);
  b.set(66, 9, T.QBLOCK_COIN);
  b.set(72, 12, T.KOOPA);

  b.pipe(76, 2, true);
  b.coins(8, 88, 90);
  b.set(102, 12, T.GOOMBA);
  b.set(106, 9, T.QBLOCK_STAR);

  b.set(116, 12, T.KOOPA);
  b.set(128, 12, T.GOOMBA);
  b.set(130, 12, T.GOOMBA);
  b.pipe(136, 2);
  b.coins(9, 150, 156);

  return { name: "1-2", time: 400, bg: "dusk", flagCol: b.flag(168), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 1-3 — night, coin-rich.
// ---------------------------------------------------------------------------
function world3() {
  const w = 182;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [30, 50, 78, 100, 132, 150].forEach((c, i) => b.pit(c, i % 3 === 0 ? 3 : 2));

  b.set(10, 9, T.QBLOCK_MUSH);
  b.set(12, 9, T.QBLOCK_ICE);
  b.coins(9, 16, 22);
  b.set(24, 12, T.GOOMBA);

  b.pipe(38, 2, true);
  b.set(44, 12, T.KOOPA);
  b.set(58, 9, T.QBLOCK_COIN);
  b.set(60, 9, T.QBLOCK_COIN);
  b.set(62, 9, T.QBLOCK_1UP);

  b.set(70, 12, T.GOOMBA);
  b.set(72, 12, T.GOOMBA);
  b.pipe(86, 3, true);
  b.set(94, 12, T.KOOPA);
  b.set(96, 12, T.KOOPA);

  b.set(108, 9, T.QBLOCK_STAR);
  b.coins(9, 112, 118);
  b.set(140, 12, T.GOOMBA);
  b.pipe(160, 2);
  b.coins(9, 154, 158);

  return { name: "1-3", time: 400, bg: "night", flagCol: b.flag(172), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 1-4 — day, slightly longer.
// ---------------------------------------------------------------------------
function world4() {
  const w = 190;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [22, 44, 66, 92, 118, 140, 162].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(14, 12, T.GOOMBA);
  b.pipe(30, 2, true);
  b.set(36, 12, T.GOOMBA);
  b.set(38, 12, T.KOOPA);
  b.set(52, 9, T.QBLOCK_ICE);
  b.set(54, 9, T.QBLOCK_COIN);
  b.coins(9, 58, 62);

  b.pipe(74, 3, true);
  b.set(82, 12, T.GOOMBA);
  b.set(84, 12, T.GOOMBA);
  b.set(100, 9, T.QBLOCK_STAR);
  b.set(102, 9, T.QBLOCK_1UP);
  b.set(110, 12, T.KOOPA);

  b.set(134, 12, T.GOOMBA);
  b.pipe(150, 2, true);
  b.set(158, 12, T.GOOMBA);
  b.coins(9, 168, 174);

  return { name: "1-4", time: 400, bg: "day", flagCol: b.flag(182), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 2-1 — snow plains (Ice Flowers + falling snow background).
// ---------------------------------------------------------------------------
function snow1() {
  const w = 184;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [26, 48, 72, 96, 124, 150].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(10, 9, T.QBLOCK_ICE);
  b.coins(9, 14, 20);
  b.set(22, 12, T.GOOMBA);

  b.pipe(34, 2, true);
  b.set(40, 12, T.KOOPA);
  b.set(56, 9, T.QBLOCK_ICE);
  b.set(58, 9, T.QBLOCK_COIN);
  b.set(64, 12, T.GOOMBA);
  b.set(66, 12, T.GOOMBA);

  b.set(80, 9, T.QBLOCK_STAR);
  b.coins(9, 84, 90);
  b.pipe(104, 3, true);
  b.set(112, 12, T.KOOPA);
  b.set(114, 12, T.KOOPA);

  b.set(140, 12, T.GOOMBA);
  b.set(158, 9, T.QBLOCK_1UP);
  b.coins(9, 162, 168);

  return { name: "2-1", time: 400, bg: "snow", flagCol: b.flag(176), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 2-2 — mini-boss arena: the Hammer King.
// ---------------------------------------------------------------------------
function miniBoss() {
  const w = 70;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  b.pit(12, 2);
  b.pit(22, 2);

  // Stock up before the fight.
  b.set(5, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(16, 9, T.QBLOCK_MUSH);
  b.set(28, 9, T.QBLOCK_ICE);
  b.coins(9, 30, 34);
  b.set(26, 12, T.GOOMBA);

  // Arena.
  b.set(48, b.height - 3, T.BOSS);
  b.set(60, b.height - 3, T.HARD);
  b.set(60, b.height - 4, T.AXE);
  for (let r = b.height - 6; r < b.height - 1; r++) b.set(64, r, T.HARD);

  return {
    name: "2-2",
    time: 300,
    bg: "castle",
    flagCol: w + 5,
    boss: true,
    bossType: "mini",
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World 2-3 — snow, the run-up to the castle.
// ---------------------------------------------------------------------------
function snow2() {
  const w = 188;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [24, 46, 70, 95, 120, 146, 166].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_ICE);
  b.set(10, 9, T.QBLOCK_MUSH);
  b.coins(9, 14, 20);
  b.set(22, 12, T.KOOPA);

  b.pipe(34, 3, true);
  b.set(42, 12, T.GOOMBA);
  b.set(44, 12, T.GOOMBA);
  b.set(58, 9, T.QBLOCK_STAR);
  b.set(60, 9, T.QBLOCK_COIN);
  b.set(68, 12, T.KOOPA);

  b.pipe(82, 2, true);
  b.coins(9, 90, 94);
  b.set(106, 12, T.GOOMBA);
  b.set(108, 12, T.GOOMBA);
  b.set(110, 9, T.QBLOCK_ICE);
  b.set(112, 9, T.QBLOCK_1UP);

  b.set(138, 12, T.KOOPA);
  b.pipe(154, 2, true);
  b.set(160, 12, T.GOOMBA);
  b.coins(9, 172, 178);

  return { name: "2-3", time: 400, bg: "snow", flagCol: b.flag(180), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 2-4 — night approach to the castle, the longest stage.
// ---------------------------------------------------------------------------
function night2() {
  const w = 200;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [24, 52, 80, 108, 136, 164, 188].forEach((c) => b.pit(c, 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(10, 9, T.QBLOCK_MUSH);
  b.coins(9, 14, 18);
  b.set(16, 12, T.GOOMBA);

  b.pipe(36, 2, true);
  b.set(30, 9, T.QBLOCK_ICE);
  b.set(46, 12, T.GOOMBA);
  b.set(58, 9, T.QBLOCK_COIN);

  b.set(64, 12, T.KOOPA);
  b.set(70, 9, T.QBLOCK_STAR);
  b.pipe(92, 2, true);
  b.set(102, 12, T.GOOMBA);

  b.set(120, 12, T.GOOMBA);
  b.set(122, 12, T.GOOMBA);
  b.set(128, 9, T.QBLOCK_1UP);
  b.coins(9, 124, 130);

  b.pipe(150, 2, true);
  b.set(158, 12, T.KOOPA);
  b.set(174, 12, T.GOOMBA);
  b.set(180, 9, T.QBLOCK_ICE);
  b.coins(9, 182, 186);

  return { name: "2-4", time: 400, bg: "night", flagCol: b.flag(194), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 2-castle — the final, two-phase Bowser battle.
// ---------------------------------------------------------------------------
function finalBoss() {
  const w = 78;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  b.pit(12, 2);
  b.pit(20, 2);
  b.pit(30, 3);

  // Guaranteed firepower before the fight.
  b.set(5, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(16, 6, T.QBLOCK_MUSH);
  b.set(24, 9, T.QBLOCK_ICE);
  b.set(26, 9, T.QBLOCK_1UP);
  b.coins(9, 36, 40);
  b.set(26, 12, T.GOOMBA);
  b.pipe(38, 3, true);

  // Arena.
  b.set(55, b.height - 3, T.BOSS);
  b.set(66, b.height - 3, T.HARD);
  b.set(66, b.height - 4, T.AXE);
  for (let r = b.height - 7; r < b.height - 1; r++) b.set(70, r, T.HARD);

  return {
    name: "2-castle",
    time: 400,
    bg: "castle",
    flagCol: w + 5,
    boss: true,
    bossType: "bowser",
    tiles: b.toRows(),
    width: w,
  };
}

export const LEVELS = [
  world1(),
  world2(),
  world3(),
  world4(),
  snow1(),
  miniBoss(),
  snow2(),
  night2(),
  finalBoss(),
];
