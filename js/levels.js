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
  // A short floating platform (bonus route / aerial challenge), never the only
  // way forward — the flat ground always runs underneath it.
  platform(row, from, to, ch = T.HARD) {
    this.hline(row, from, to, ch);
  }
  // A spiked enemy spawn (can't be stomped). Placed on flat ground.
  spiny(col, row = this.height - 3) {
    this.set(col, row, T.SPINY);
  }
  // A winged Koopa that hops in place; stomp it to drop a ground Koopa.
  para(col, row = this.height - 3) {
    this.set(col, row, T.PARATROOPA);
  }
  // A Cheep Cheep fish, swimming in an upper-water lane (off the floor path).
  cheep(col, row) {
    this.set(col, row, T.CHEEP);
  }
  // A coral/rock pillar rising `h` tiles from the seabed (an obstacle to swim
  // over). Kept short so a couple of strokes always clear it.
  coral(col, h = 2) {
    for (let i = 0; i < h; i++) this.set(col, this.height - 3 - i, T.HARD);
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
  b.set(11, 9, T.QBLOCK_LEAF); // ← new: Super Leaf (raccoon tail)
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
  // Bonus brick platform with a coin run over the mid-section.
  b.platform(7, 96, 100, T.BRICK);
  b.coins(6, 96, 100);
  b.set(100, 9, T.QBLOCK_STAR);
  b.set(102, 9, T.QBLOCK_1UP);
  b.set(110, 12, T.KOOPA);

  b.set(126, 12, T.GOOMBA);
  b.pipe(150, 2, true);
  b.set(158, 12, T.GOOMBA);
  b.coins(9, 168, 174);

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(106);
  b.spiny(126);
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

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(54);
  b.spiny(77);
  b.spiny(127);
  b.spiny(173);
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

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(64);
  b.spiny(98);
  b.spiny(126);
  b.spiny(174);
  return { name: "2-4", time: 400, bg: "night", flagCol: b.flag(194), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 3-1 — underground caverns (new cave theme, Spinies appear).
// ---------------------------------------------------------------------------
function cave1() {
  const w = 190;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [26, 48, 72, 96, 122, 148, 170].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(10, 9, T.QBLOCK_ICE);
  b.set(12, 9, T.QBLOCK_BOOM); // ← new: Boomerang Flower
  b.coins(9, 16, 20);

  b.pipe(34, 2, true);
  b.set(40, 12, T.GOOMBA);
  // Aerial coin run on a stone ledge.
  b.platform(7, 56, 60, T.HARD);
  b.coins(6, 56, 60);
  b.set(58, 9, T.QBLOCK_STAR);
  b.set(64, 12, T.KOOPA);
  b.pipe(104, 3, true);
  b.set(112, 12, T.GOOMBA);
  b.set(114, 12, T.GOOMBA);
  b.set(134, 9, T.QBLOCK_1UP);
  b.coins(9, 136, 140);
  b.set(160, 12, T.KOOPA);
  b.coins(9, 176, 182);

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(56);
  b.spiny(79);
  b.spiny(129);
  b.spiny(156);
  return { name: "3-1", time: 400, bg: "cave", flagCol: b.flag(184), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 3-2 — deep caverns, the toughest gauntlet of pits and Spinies.
// ---------------------------------------------------------------------------
function cave2() {
  const w = 196;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [22, 40, 60, 82, 104, 126, 150, 174].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(10, 9, T.QBLOCK_ICE);
  b.set(12, 9, T.QBLOCK_MUSH);
  b.pipe(30, 3, true);
  b.set(52, 12, T.KOOPA);
  // Stepping-stone stone blocks above a wide gap (bonus high road).
  b.platform(8, 70, 72, T.HARD);
  b.coins(7, 70, 72);
  b.set(74, 9, T.QBLOCK_STAR);

  b.set(92, 12, T.GOOMBA);
  b.set(94, 12, T.GOOMBA);
  b.pipe(112, 2, true);
  b.set(134, 9, T.QBLOCK_ICE);
  b.set(136, 9, T.QBLOCK_1UP);
  b.set(140, 12, T.KOOPA);
  b.set(164, 12, T.GOOMBA);
  b.coins(9, 184, 188);

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(48);
  b.spiny(67);
  b.spiny(157);
  b.spiny(182);
  return { name: "3-2", time: 400, bg: "cave", flagCol: b.flag(190), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 3-3 — fortress mid-boss: a tougher, faster Shadow Bowser.
// ---------------------------------------------------------------------------
function fortressBoss() {
  const w = 74;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  b.pit(12, 2);
  b.pit(22, 2);
  b.pit(34, 3);

  // Stock up on firepower before the gate.
  b.set(5, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(18, 9, T.QBLOCK_MUSH);
  b.set(28, 9, T.QBLOCK_ICE);
  b.set(30, 9, T.QBLOCK_1UP);
  b.coins(9, 42, 46);
  b.pipe(40, 2, true);

  // Arena.
  b.set(52, b.height - 3, T.BOSS);
  b.set(64, b.height - 3, T.HARD);
  b.set(64, b.height - 4, T.AXE);
  for (let r = b.height - 6; r < b.height - 1; r++) b.set(68, r, T.HARD);

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(26);
  return {
    name: "3-3",
    time: 300,
    bg: "castle",
    flagCol: w + 5,
    boss: true,
    bossType: "fortress",
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World 3-4 — the sky run: the hardest platforming stage before the castle.
// ---------------------------------------------------------------------------
function sky3() {
  const w = 204;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [24, 44, 66, 88, 110, 134, 158, 182].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(8, 9, T.QBLOCK_MUSH);
  b.set(10, 9, T.QBLOCK_ICE);
  b.coins(9, 14, 18);

  b.pipe(32, 3, true);
  b.set(38, 12, T.KOOPA);
  // High brick road with a star reward.
  b.platform(7, 54, 60, T.BRICK);
  b.coins(6, 54, 60);
  b.set(57, 7, T.QBLOCK_STAR);

  b.set(78, 12, T.GOOMBA);
  b.set(80, 12, T.GOOMBA);
  b.pipe(96, 2, true);
  b.set(120, 9, T.QBLOCK_1UP);
  b.coins(9, 122, 126);
  b.set(146, 12, T.KOOPA);
  b.set(150, 12, T.KOOPA);
  b.set(172, 12, T.GOOMBA);
  b.coins(9, 192, 196);

  // Spiked Spinies — can't be stomped; use fire/ice/star/shell.
  b.spiny(52);
  b.spiny(73);
  b.spiny(117);
  b.spiny(125);
  b.spiny(142);
  b.spiny(165);
  return { name: "3-4", time: 400, bg: "dusk", flagCol: b.flag(198), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 4-1 — "深渊" the long dark: dense pits, Paratroopas and a Boomerang.
// ---------------------------------------------------------------------------
function abyss1() {
  const w = 212;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [22, 40, 60, 80, 100, 122, 146, 168, 190].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(6, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_LEAF);
  b.set(10, 9, T.QBLOCK_BOOM);
  b.coins(9, 14, 18);

  b.pipe(30, 3, true);
  b.set(36, 12, T.KOOPA);
  b.para(50);
  b.platform(7, 66, 70, T.HARD);
  b.coins(6, 66, 70);
  b.set(72, 9, T.QBLOCK_STAR);

  b.set(90, 12, T.GOOMBA);
  b.set(92, 12, T.GOOMBA);
  b.para(110);
  b.pipe(112, 2, true);
  b.set(130, 9, T.QBLOCK_ICE);
  b.set(132, 9, T.QBLOCK_1UP);

  b.set(140, 12, T.KOOPA);
  b.para(160);
  b.set(178, 12, T.GOOMBA);
  b.coins(9, 198, 204);
  b.spiny(153);
  b.spiny(197);

  return { name: "4-1", time: 350, bg: "night", flagCol: b.flag(206), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 4-2 — "熔窟" the deep: cave gauntlet of Spinies + Paratroopas.
// ---------------------------------------------------------------------------
function abyss2() {
  const w = 220;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [20, 38, 58, 78, 98, 120, 140, 162, 184, 204].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(6, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_LEAF);
  b.set(10, 9, T.QBLOCK_MUSH);

  b.pipe(28, 3, true);
  b.set(34, 12, T.KOOPA);
  b.para(48);
  b.platform(8, 66, 68, T.HARD);
  b.coins(7, 66, 68);
  b.set(70, 9, T.QBLOCK_BOOM);

  b.set(86, 12, T.GOOMBA);
  b.set(88, 12, T.GOOMBA);
  b.pipe(108, 2, true);
  b.para(130);
  b.set(150, 9, T.QBLOCK_ICE);
  b.set(152, 9, T.QBLOCK_STAR);

  b.set(154, 12, T.KOOPA);
  b.set(166, 9, T.QBLOCK_1UP);
  b.para(174);
  b.set(196, 12, T.GOOMBA);
  b.coins(9, 210, 214);
  b.spiny(147);
  b.spiny(191);

  return { name: "4-2", time: 350, bg: "cave", flagCol: b.flag(214), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 4-3 — "最终冲刺" final ascent: the hardest stage before the castle.
// ---------------------------------------------------------------------------
function abyss3() {
  const w = 228;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);
  [22, 40, 58, 76, 96, 116, 136, 158, 180, 202].forEach((c, i) => b.pit(c, i % 2 ? 3 : 2));

  b.set(6, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_LEAF);
  b.set(10, 9, T.QBLOCK_BOOM);
  b.coins(9, 14, 18);

  b.pipe(32, 3, true);
  b.set(38, 12, T.KOOPA);
  b.para(52);
  // High brick road with a star.
  b.platform(7, 64, 70, T.BRICK);
  b.coins(6, 64, 70);
  b.set(67, 7, T.QBLOCK_STAR);

  b.set(86, 12, T.GOOMBA);
  b.set(88, 12, T.GOOMBA);
  b.para(108);
  b.pipe(126, 2, true);
  b.set(144, 9, T.QBLOCK_ICE);
  b.set(146, 9, T.QBLOCK_1UP);

  b.set(150, 12, T.KOOPA);
  b.set(152, 12, T.KOOPA);
  b.para(172);
  b.set(192, 12, T.GOOMBA);
  b.coins(9, 214, 220);
  b.spiny(48);
  b.spiny(103);
  b.spiny(187);

  return { name: "4-3", time: 350, bg: "dusk", flagCol: b.flag(222), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 5-1 — "深海" underwater: swim with strokes, dodge Cheep Cheeps.
// A continuous sea floor (no fatal pits) with coral pillars to swim over.
// ---------------------------------------------------------------------------
function water1() {
  const w = 200;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  b.set(6, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_BOOM); // boomerang is great underwater
  b.coins(8, 12, 16);

  b.coral(24, 2);
  b.cheep(20, 6);
  b.cheep(34, 8);
  b.coins(7, 40, 44);
  b.coral(48, 2);
  b.coral(50, 2);

  b.cheep(58, 5);
  b.cheep(70, 7);
  b.set(64, 9, T.QBLOCK_ICE);
  b.coral(80, 3);
  b.coins(6, 86, 92);

  b.cheep(96, 6);
  b.cheep(108, 8);
  b.cheep(120, 5);
  b.coral(112, 2);
  b.set(116, 9, T.QBLOCK_1UP);

  b.cheep(140, 7);
  b.coral(146, 2);
  b.cheep(158, 6);
  b.coins(7, 164, 170);
  b.cheep(176, 7);

  return { name: "5-1", time: 400, bg: "water", water: true, flagCol: b.flag(190), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 5-2 — "暗礁" deeper reef: denser fish + taller coral mazes.
// ---------------------------------------------------------------------------
function water2() {
  const w = 210;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  b.set(6, 9, T.QBLOCK_LEAF);
  b.set(8, 9, T.QBLOCK_MUSH);
  b.coins(8, 12, 16);

  b.coral(22, 2);
  b.coral(24, 3);
  b.cheep(20, 6);
  b.cheep(32, 8);
  b.cheep(38, 5);
  b.coins(7, 44, 48);

  b.coral(56, 2);
  b.cheep(60, 7);
  b.cheep(72, 6);
  b.cheep(78, 9);
  b.set(66, 9, T.QBLOCK_BOOM);
  b.coral(86, 3);
  b.coral(88, 2);

  b.cheep(98, 6);
  b.cheep(106, 8);
  b.cheep(118, 5);
  b.cheep(124, 7);
  b.coins(6, 130, 136);
  b.set(132, 9, T.QBLOCK_STAR);

  b.coral(146, 2);
  b.cheep(150, 6);
  b.cheep(162, 8);
  b.coral(168, 3);
  b.cheep(178, 6);
  b.set(150, 9, T.QBLOCK_1UP);
  b.cheep(190, 7);

  return { name: "5-2", time: 400, bg: "water", water: true, flagCol: b.flag(200), tiles: b.toRows(), width: w };
}

// ---------------------------------------------------------------------------
// World 5-3 — the underwater boss: the hovering Kraken (深海霸王).
// ---------------------------------------------------------------------------
function waterBoss() {
  const w = 82;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  // Stock up before the fight (boomerang is ideal underwater).
  b.set(5, 9, T.QBLOCK_MUSH);
  b.set(8, 9, T.QBLOCK_BOOM);
  b.set(12, 9, T.QBLOCK_MUSH);
  b.set(15, 9, T.QBLOCK_1UP);
  b.coins(7, 18, 22);
  b.coral(28, 2);
  b.coral(30, 2);

  // Arena — the Kraken hovers around the middle of the water.
  b.set(44, 6, T.BOSS);

  // Bridge axe on a coral spire near the far end (a guaranteed win route).
  b.set(68, b.height - 3, T.HARD);
  b.set(68, b.height - 4, T.AXE);
  for (let r = b.height - 7; r < b.height - 1; r++) b.set(72, r, T.HARD);

  return {
    name: "5-3",
    time: 300,
    bg: "water",
    water: true,
    flagCol: w + 5,
    boss: true,
    bossType: "kraken",
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World-castle — the final, three-phase Bowser battle.
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
    name: "终城堡",
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
  cave1(),
  cave2(),
  fortressBoss(),
  sky3(),
  abyss1(),
  abyss2(),
  abyss3(),
  water1(),
  water2(),
  waterBoss(),
  finalBoss(),
];
