// Shared tuning constants and the tile legend.

export const TILE = 32; // pixel size of one tile
export const VIEW_W = 960;
export const VIEW_H = 480;
export const ROWS = VIEW_H / TILE; // 15

// Physics (units: pixels, seconds). Tuned for a snappy, Mario-like feel.
export const GRAVITY = 2400;
export const MAX_FALL = 780;
export const WALK_ACCEL = 950;
export const RUN_ACCEL = 1600;
export const WALK_MAX = 185;
export const RUN_MAX = 330;
export const FRICTION = 1500;
export const AIR_FRICTION = 260;
export const JUMP_VELOCITY = -740;
export const JUMP_VELOCITY_RUN = -820; // a touch higher at speed
export const JUMP_CUTOFF = 0.42; // velocity retained when jump released early
export const COYOTE_TIME = 0.1; // grace period to still jump after leaving ground
export const JUMP_BUFFER = 0.13; // remember a jump press this long before landing
export const ENEMY_SPEED = 58;
export const STOMP_BOUNCE = -440;
export const STAR_TIME = 10; // seconds of invincibility
export const FIREBALL_SPEED = 380;
export const FIREBALL_BOUNCE = -360;
export const FREEZE_TIME = 5; // seconds an enemy stays frozen
export const BOSS_HP = 5;

// Tile legend ---------------------------------------------------------------
export const T = {
  EMPTY: " ",
  GROUND: "X",
  BRICK: "B",
  QBLOCK_COIN: "?",
  QBLOCK_MUSH: "M", // mushroom if small, fire flower if big
  QBLOCK_ICE: "I", // mushroom if small, ice flower if big
  QBLOCK_STAR: "S",
  QBLOCK_1UP: "1",
  USED: "U",
  HARD: "#",
  PIPE_TL: "L",
  PIPE_TR: "R",
  PIPE_BL: "l",
  PIPE_BR: "r",
  COIN: "o",
  FLAGPOLE: "F",
  FLAGBASE: "=",
  // spawn markers (converted to entities at load, then cleared)
  GOOMBA: "g",
  KOOPA: "k",
  PIRANHA: "v", // sits in the pipe below this marker
  BOSS: "W", // Bowser
  AXE: "A", // touch to defeat the boss (classic bridge axe)
};

export const SOLID = new Set([
  T.GROUND,
  T.BRICK,
  T.QBLOCK_COIN,
  T.QBLOCK_MUSH,
  T.QBLOCK_ICE,
  T.QBLOCK_STAR,
  T.QBLOCK_1UP,
  T.USED,
  T.HARD,
  T.PIPE_TL,
  T.PIPE_TR,
  T.PIPE_BL,
  T.PIPE_BR,
  T.FLAGBASE,
]);

export const QBLOCKS = new Set([
  T.QBLOCK_COIN,
  T.QBLOCK_MUSH,
  T.QBLOCK_ICE,
  T.QBLOCK_STAR,
  T.QBLOCK_1UP,
]);

export const STATE = {
  TITLE: "title",
  PLAYING: "playing",
  PAUSED: "paused",
  DYING: "dying",
  LEVEL_CLEAR: "level_clear",
  GAMEOVER: "gameover",
  WIN: "win",
};
