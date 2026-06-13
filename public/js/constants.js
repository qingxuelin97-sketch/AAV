// Shared tuning constants and the tile legend.

export const TILE = 32; // pixel size of one tile
export const VIEW_W = 960;
export const VIEW_H = 480;
export const ROWS = VIEW_H / TILE; // 15

// Physics (units: pixels, seconds). Tuned for a snappy, Mario-like feel.
export const GRAVITY = 2300;
export const MAX_FALL = 760;
export const WALK_ACCEL = 900;
export const RUN_ACCEL = 1500;
export const WALK_MAX = 190;
export const RUN_MAX = 320;
export const FRICTION = 1300;
export const AIR_FRICTION = 320;
export const JUMP_VELOCITY = -760;
export const JUMP_CUTOFF = 0.45; // velocity retained when jump released early
export const COYOTE_TIME = 0.09; // grace period to still jump after leaving ground
export const JUMP_BUFFER = 0.12; // remember a jump press this long before landing
export const ENEMY_SPEED = 60;
export const STOMP_BOUNCE = -430;

// Tile legend ---------------------------------------------------------------
export const T = {
  EMPTY: " ",
  GROUND: "X",
  BRICK: "B",
  QBLOCK_COIN: "?",
  QBLOCK_MUSH: "M",
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
};

export const SOLID = new Set([
  T.GROUND,
  T.BRICK,
  T.QBLOCK_COIN,
  T.QBLOCK_MUSH,
  T.QBLOCK_1UP,
  T.USED,
  T.HARD,
  T.PIPE_TL,
  T.PIPE_TR,
  T.PIPE_BL,
  T.PIPE_BR,
  T.FLAGBASE,
]);

export const QBLOCKS = new Set([T.QBLOCK_COIN, T.QBLOCK_MUSH, T.QBLOCK_1UP]);

export const STATE = {
  TITLE: "title",
  PLAYING: "playing",
  PAUSED: "paused",
  DYING: "dying",
  LEVEL_CLEAR: "level_clear",
  GAMEOVER: "gameover",
  WIN: "win",
};
