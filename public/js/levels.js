// Level definitions. Levels are built programmatically with a small builder so
// tile alignment is always correct, then exposed as arrays of row strings.

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

  // Solid ground from col `from` to `to`, occupying rows [topRow .. bottom].
  ground(from, to, topRow = this.height - 2) {
    for (let r = topRow; r < this.height; r++) this.hline(r, from, to, T.GROUND);
  }

  // A vertical pipe whose opening top is at row `topRow`, height in tiles.
  // Pass piranha=true to plant a Piranha Plant inside it.
  pipe(col, topRow, heightTiles, piranha = false) {
    this.set(col, topRow, T.PIPE_TL);
    this.set(col + 1, topRow, T.PIPE_TR);
    for (let r = topRow + 1; r < topRow + heightTiles; r++) {
      this.set(col, r, T.PIPE_BL);
      this.set(col + 1, r, T.PIPE_BR);
    }
    if (piranha) this.set(col, topRow - 1, T.PIRANHA); // marker, one tile above the rim
  }

  // A staircase of HARD blocks going up to the right (or left if dir=-1).
  stairs(startCol, steps, baseRow = this.height - 3, dir = 1) {
    for (let i = 0; i < steps; i++) {
      const col = startCol + i * dir;
      for (let h = 0; h <= i; h++) {
        this.set(col, baseRow - h, T.HARD);
      }
    }
  }

  coins(row, from, to, step = 1) {
    for (let c = from; c <= to; c += step) this.set(c, row, T.COIN);
  }

  toRows() {
    return this.grid.map((row) => row.join(""));
  }
}

// ---------------------------------------------------------------------------
// World 1-1 — the gentle introduction.
// ---------------------------------------------------------------------------
function world1() {
  const w = 212;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  // Gaps (clear the ground rows to make pits).
  const gaps = [
    [69, 71],
    [86, 88],
    [153, 155],
  ];
  for (const [a, c] of gaps) {
    for (let r = b.height - 2; r < b.height; r++) b.hline(r, a, c, T.EMPTY);
  }

  // Opening question block.
  b.set(16, 9, T.QBLOCK_COIN);

  // First block cluster: brick ? brick ? brick (with a mushroom).
  b.set(20, 9, T.BRICK);
  b.set(21, 9, T.QBLOCK_MUSH);
  b.set(22, 9, T.BRICK);
  b.set(23, 9, T.QBLOCK_COIN);
  b.set(24, 9, T.BRICK);
  b.set(22, 5, T.QBLOCK_COIN); // high bonus block

  // Pipes of increasing height (the tallest hides a Piranha Plant).
  b.pipe(28, 11, 2);
  b.pipe(38, 10, 3);
  b.pipe(46, 9, 4, true);
  b.pipe(57, 9, 4);

  // A Super Star hidden in a brick up high — grab it and go invincible!
  b.set(35, 5, T.QBLOCK_STAR);

  // Goombas.
  b.set(33, 12, T.GOOMBA);
  b.set(52, 12, T.GOOMBA);
  b.set(53, 12, T.GOOMBA);
  b.set(82, 12, T.GOOMBA);

  // Floating coins over the first pit.
  b.coins(8, 69, 71);

  // Mid brick run with a hidden 1-up.
  b.set(77, 9, T.BRICK);
  b.set(78, 9, T.BRICK);
  b.set(79, 9, T.QBLOCK_1UP);
  b.set(80, 9, T.BRICK);
  b.set(81, 9, T.BRICK);

  // Second pit + coin arc.
  b.coins(8, 86, 88);

  // Koopa patrol on a brick platform.
  b.hline(9, 96, 102, T.BRICK);
  b.set(99, 8, T.KOOPA);
  b.coins(7, 97, 101);

  // A double pipe valley with a goomba between.
  b.pipe(108, 10, 3);
  b.set(112, 12, T.GOOMBA);
  b.pipe(114, 10, 3);

  // Question block row.
  b.set(122, 6, T.QBLOCK_COIN);
  b.set(124, 6, T.QBLOCK_MUSH);
  b.set(126, 6, T.QBLOCK_COIN);
  b.coins(10, 122, 126, 2);

  // Brick steps up then a long brick bridge with koopa.
  b.stairs(132, 4, b.height - 3, 1);
  b.hline(9, 140, 150, T.BRICK);
  b.set(145, 8, T.KOOPA);
  b.set(143, 8, T.GOOMBA);
  b.coins(7, 141, 149, 2);

  // Big pit (153-155) already cut; coins to encourage the run-jump.
  b.coins(7, 152, 156);

  // Pyramid stairs up and down (classic).
  b.stairs(162, 4, b.height - 3, 1);
  b.stairs(171, 4, b.height - 3, -1);

  // Final goombas before the flag.
  b.set(180, 12, T.GOOMBA);
  b.set(186, 12, T.GOOMBA);

  // Ending staircase.
  b.stairs(190, 8, b.height - 3, 1);

  // Flagpole + base.
  const flagCol = 202;
  for (let r = 3; r <= b.height - 3; r++) b.set(flagCol, r, T.FLAGPOLE);
  b.set(flagCol, b.height - 2, T.FLAGBASE);

  return {
    name: "1-1",
    time: 400,
    bg: "day",
    flagCol,
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World 1-2 — pipes, gaps and tighter platforming.
// ---------------------------------------------------------------------------
function world2() {
  const w = 224;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  const gaps = [
    [30, 33],
    [58, 61],
    [70, 73],
    [110, 114],
    [140, 142],
    [170, 174],
  ];
  for (const [a, c] of gaps) {
    for (let r = b.height - 2; r < b.height; r++) b.hline(r, a, c, T.EMPTY);
  }

  // Intro coins + mushroom.
  b.set(10, 9, T.QBLOCK_MUSH);
  b.coins(8, 12, 16);

  // Floating brick islands over the first gap.
  b.hline(8, 29, 34, T.BRICK);
  b.set(31, 7, T.QBLOCK_COIN);
  b.coins(6, 30, 33);

  // Pipe maze (two of them guarded by Piranha Plants).
  b.pipe(40, 11, 2);
  b.pipe(45, 10, 3, true);
  b.pipe(50, 9, 4, true);
  b.set(43, 12, T.GOOMBA);
  b.set(48, 12, T.GOOMBA);

  // Floating platforms over twin gaps.
  b.hline(9, 57, 62, T.HARD);
  b.hline(9, 69, 74, T.HARD);
  b.coins(7, 58, 61);
  b.coins(7, 70, 73);
  b.set(72, 8, T.KOOPA);

  // Brick ceiling section with coins beneath.
  b.hline(5, 82, 92, T.BRICK);
  b.set(86, 5, T.QBLOCK_1UP);
  b.coins(11, 82, 92, 2);
  b.set(84, 12, T.GOOMBA);
  b.set(90, 12, T.GOOMBA);

  // Tall pipe wall to climb over.
  b.pipe(98, 8, 5);
  b.set(101, 12, T.GOOMBA);

  // Fire Flower reward (gives fire if you arrive big) up on the ceiling run.
  b.set(88, 5, T.QBLOCK_MUSH);
  b.set(106, 6, T.QBLOCK_STAR);

  // Big gap with a single mid platform.
  b.hline(9, 111, 113, T.HARD);
  b.coins(7, 110, 114);

  // Staircase + koopa.
  b.stairs(120, 5, b.height - 3, 1);
  b.set(124, 7, T.KOOPA);

  // Question block trio.
  b.set(132, 6, T.QBLOCK_COIN);
  b.set(134, 6, T.QBLOCK_MUSH);
  b.set(136, 6, T.QBLOCK_COIN);

  // Floating step over a gap.
  b.hline(8, 139, 143, T.BRICK);
  b.coins(6, 140, 142);

  // Descending then ascending pipes.
  b.pipe(150, 9, 4);
  b.pipe(158, 10, 3);
  b.pipe(166, 11, 2);
  b.set(154, 12, T.GOOMBA);
  b.set(162, 12, T.GOOMBA);

  // Long gap with hard-block stepping stones.
  b.hline(10, 169, 170, T.HARD);
  b.hline(8, 173, 174, T.HARD);
  b.coins(6, 173, 174);

  // Enemy gauntlet.
  b.set(182, 12, T.GOOMBA);
  b.set(184, 12, T.KOOPA);
  b.set(188, 12, T.GOOMBA);

  // Final ascending stairs.
  b.stairs(196, 7, b.height - 3, 1);

  const flagCol = 214;
  for (let r = 3; r <= b.height - 3; r++) b.set(flagCol, r, T.FLAGPOLE);
  b.set(flagCol, b.height - 2, T.FLAGBASE);

  return {
    name: "1-2",
    time: 380,
    bg: "dusk",
    flagCol,
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World 1-3 — the gauntlet: stairs, koopas and precision jumps.
// ---------------------------------------------------------------------------
function world3() {
  const w = 236;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  const gaps = [
    [24, 27],
    [44, 48],
    [66, 70],
    [88, 93],
    [120, 125],
    [150, 156],
    [190, 195],
  ];
  for (const [a, c] of gaps) {
    for (let r = b.height - 2; r < b.height; r++) b.hline(r, a, c, T.EMPTY);
  }

  b.set(8, 9, T.QBLOCK_MUSH);

  // Floating brick path over a gap.
  b.hline(8, 23, 28, T.BRICK);
  b.set(25, 6, T.QBLOCK_COIN);
  b.coins(6, 24, 27);

  // Staircase tower.
  b.stairs(33, 6, b.height - 3, 1);
  b.set(36, 7, T.KOOPA);

  // Floating hard-block islands across a wide gap.
  b.hline(9, 43, 44, T.HARD);
  b.hline(7, 46, 47, T.HARD);
  b.coins(5, 46, 47);
  b.set(47, 6, T.GOOMBA);

  // Pipe + koopa combo (Piranha Plant in the pipe).
  b.pipe(54, 9, 4, true);
  b.set(57, 12, T.GOOMBA);
  b.set(59, 12, T.KOOPA);
  b.set(50, 4, T.QBLOCK_STAR); // star to survive the gauntlet

  // Bridge of bricks with bonus.
  b.hline(8, 64, 72, T.BRICK);
  b.set(68, 4, T.QBLOCK_1UP);
  b.coins(7, 65, 71, 2);
  b.set(67, 7, T.KOOPA);

  // Ceiling spikes of bricks with coins.
  b.hline(4, 78, 88, T.BRICK);
  b.coins(11, 78, 88, 2);
  b.set(82, 12, T.GOOMBA);
  b.set(85, 12, T.GOOMBA);

  // Wide pit with double platforms.
  b.hline(10, 89, 90, T.HARD);
  b.hline(8, 92, 93, T.HARD);
  b.coins(6, 92, 93);

  // Pyramid up/down.
  b.stairs(100, 5, b.height - 3, 1);
  b.stairs(110, 5, b.height - 3, -1);
  b.set(105, 7, T.KOOPA);

  // Big chasm — needs a running jump from a platform.
  b.hline(9, 118, 119, T.HARD);
  b.hline(9, 126, 127, T.HARD);
  b.coins(7, 120, 125);

  // Question block cluster.
  b.set(132, 6, T.QBLOCK_COIN);
  b.set(133, 6, T.QBLOCK_MUSH);
  b.set(134, 6, T.QBLOCK_COIN);
  b.set(133, 10, T.QBLOCK_COIN);

  // Triple pipe wall climb (two with Piranha Plants).
  b.pipe(140, 11, 2);
  b.pipe(143, 9, 4, true);
  b.pipe(146, 7, 6, true);
  b.set(149, 12, T.GOOMBA);

  // The longest gap with a single mid stone.
  b.hline(9, 152, 154, T.HARD);
  b.coins(7, 150, 156);

  // Enemy parade on flat ground.
  b.set(162, 12, T.GOOMBA);
  b.set(164, 12, T.KOOPA);
  b.set(168, 12, T.GOOMBA);
  b.set(172, 12, T.KOOPA);

  // Tall staircase, then floating bonus.
  b.stairs(178, 6, b.height - 3, 1);
  b.hline(5, 186, 189, T.BRICK);
  b.set(187, 5, T.QBLOCK_1UP);
  b.coins(7, 190, 195);

  // Final approach with stepping stones over the last pit.
  b.hline(10, 191, 192, T.HARD);
  b.hline(8, 194, 195, T.HARD);

  // Grand ending staircase.
  b.stairs(200, 9, b.height - 3, 1);
  b.set(205, 12, T.GOOMBA);

  const flagCol = 226;
  for (let r = 2; r <= b.height - 3; r++) b.set(flagCol, r, T.FLAGPOLE);
  b.set(flagCol, b.height - 2, T.FLAGBASE);

  return {
    name: "1-3",
    time: 360,
    bg: "night",
    flagCol,
    tiles: b.toRows(),
    width: w,
  };
}

// ---------------------------------------------------------------------------
// World 1-4 — the castle finale: lava-like pits, Piranha gardens and a wall of
// shells. The toughest test, capped by a triumphant flag.
// ---------------------------------------------------------------------------
function world4() {
  const w = 248;
  const b = new LevelBuilder(w);
  b.ground(0, w - 1);

  const gaps = [
    [20, 24],
    [40, 45],
    [60, 66],
    [84, 90],
    [108, 114],
    [132, 139],
    [158, 164],
    [188, 196],
  ];
  for (const [a, c] of gaps) {
    for (let r = b.height - 2; r < b.height; r++) b.hline(r, a, c, T.EMPTY);
  }

  // Generous early power-ups, because it gets hard fast.
  b.set(7, 9, T.QBLOCK_MUSH);
  b.set(12, 9, T.QBLOCK_STAR);

  // Brick spans bridging the first chasms.
  b.hline(8, 19, 25, T.BRICK);
  b.set(22, 5, T.QBLOCK_COIN);
  b.coins(6, 20, 24);
  b.hline(9, 39, 46, T.HARD);
  b.coins(7, 40, 45);

  // Piranha garden — three pipes in a row, all guarded.
  b.pipe(50, 10, 3, true);
  b.pipe(54, 10, 3, true);
  b.pipe(58, 10, 3, true);
  b.set(52, 12, T.GOOMBA);

  // Floating platforms over a wide pit.
  b.hline(9, 61, 62, T.HARD);
  b.hline(7, 64, 65, T.HARD);
  b.coins(5, 64, 65);

  // Koopa wall: a brick bridge crowded with troopas.
  b.hline(9, 70, 82, T.BRICK);
  b.set(72, 8, T.KOOPA);
  b.set(76, 8, T.KOOPA);
  b.set(80, 8, T.KOOPA);
  b.set(74, 4, T.QBLOCK_1UP);
  b.coins(7, 70, 82, 3);

  // Stepping stones across lava-like gap (84-90).
  b.hline(10, 85, 86, T.HARD);
  b.hline(8, 88, 89, T.HARD);
  b.coins(6, 85, 89, 2);

  // Pyramid climb with a fire flower at the top.
  b.stairs(95, 5, b.height - 3, 1);
  b.set(99, 6, T.QBLOCK_MUSH);

  // Twin pipes around a gap (108-114).
  b.pipe(104, 9, 4, true);
  b.hline(9, 110, 112, T.HARD);
  b.coins(7, 110, 112);
  b.pipe(116, 9, 4, true);

  // Question cluster + star.
  b.set(122, 6, T.QBLOCK_COIN);
  b.set(124, 6, T.QBLOCK_STAR);
  b.set(126, 6, T.QBLOCK_COIN);
  b.set(128, 12, T.GOOMBA);

  // Long chasm (132-139) with a mid platform and coin reward.
  b.hline(9, 134, 137, T.HARD);
  b.coins(7, 132, 139);

  // Descending pipe staircase.
  b.pipe(144, 8, 5);
  b.pipe(150, 9, 4, true);
  b.pipe(155, 10, 3);
  b.set(148, 12, T.KOOPA);

  // Wide chasm (158-164) — needs a full running jump from a ramp.
  b.stairs(166, 4, b.height - 3, 1);

  // Final enemy parade.
  b.set(172, 12, T.GOOMBA);
  b.set(174, 12, T.KOOPA);
  b.set(178, 12, T.GOOMBA);
  b.set(181, 12, T.KOOPA);
  b.hline(7, 172, 182, T.BRICK);
  b.coins(5, 172, 182, 2);

  // The last big gap (188-196) with stepping stones.
  b.hline(10, 189, 190, T.HARD);
  b.hline(8, 192, 193, T.HARD);
  b.hline(6, 195, 195, T.HARD);

  // Grand finale staircase.
  b.stairs(200, 10, b.height - 3, 1);
  b.set(206, 12, T.GOOMBA);

  const flagCol = 238;
  for (let r = 2; r <= b.height - 3; r++) b.set(flagCol, r, T.FLAGPOLE);
  b.set(flagCol, b.height - 2, T.FLAGBASE);

  return {
    name: "1-4",
    time: 400,
    bg: "dusk",
    flagCol,
    tiles: b.toRows(),
    width: w,
  };
}

export const LEVELS = [world1(), world2(), world3(), world4()];
