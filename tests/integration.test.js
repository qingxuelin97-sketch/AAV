import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../public/js/game.js";
import { STATE, TILE } from "../public/js/constants.js";

// A no-op 2D context that satisfies every drawing call the renderer makes.
function makeCtx() {
  const ctx = {
    canvas: { width: 960, height: 480 },
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 }),
  };
  const methods = [
    "clearRect", "fillRect", "strokeRect", "beginPath", "arc", "rect", "fill",
    "stroke", "moveTo", "lineTo", "quadraticCurveTo", "closePath", "save",
    "restore", "translate", "scale", "rotate", "fillText", "strokeText",
    "setTransform", "clip",
  ];
  for (const m of methods) ctx[m] = () => {};
  return ctx;
}

function makeHarness(inputState = {}) {
  const canvas = { getContext: () => makeCtx() };
  const input = {
    state: { left: false, right: false, jump: false, run: false, ...inputState },
    consume: () => false,
    flush: () => {},
  };
  const audio = new Proxy({}, { get: () => () => {} });
  const events = {};
  const hooks = {
    onHud: () => {},
    onPause: () => {},
    onGameOver: (s) => (events.gameover = s),
    onWin: (s) => (events.win = s),
    onMute: () => {},
  };
  return { game: new Game(canvas, input, audio, hooks), input, events };
}

test("a full game starts and steps without errors", () => {
  const { game, input } = makeHarness({ right: true, jump: true });
  game.start();
  assert.equal(game.state, STATE.PLAYING);
  for (let i = 0; i < 600; i++) {
    game.update(1 / 60);
    game.render();
  }
  // It ran for ~10s of game time and is still in a valid state.
  assert.ok(
    [STATE.PLAYING, STATE.LEVEL_CLEAR, STATE.DYING].includes(game.state),
    `unexpected state ${game.state}`
  );
});

test("reaching the flagpole clears the level and advances", () => {
  const { game } = makeHarness();
  game.start();
  // Teleport the player onto the flag column.
  game.player.x = game.world.flagCol * TILE;
  game.update(1 / 60); // detect flag
  assert.equal(game.state, STATE.LEVEL_CLEAR, "entered level-clear");

  const startLevel = game.levelIndex;
  for (let i = 0; i < 1200; i++) {
    game.update(1 / 60);
    game.render();
    if (game.levelIndex !== startLevel || game.state === STATE.WIN) break;
  }
  assert.ok(
    game.levelIndex > startLevel || game.state === STATE.WIN,
    "advanced to the next level (or won)"
  );
});

test("dying decrements lives and respawns", () => {
  const { game } = makeHarness();
  game.start();
  const lives = game.lives;
  game.killPlayer();
  assert.equal(game.state, STATE.DYING);
  for (let i = 0; i < 200; i++) {
    game.update(1 / 60);
    game.render();
    if (game.state === STATE.PLAYING) break;
  }
  assert.equal(game.lives, lives - 1, "lost one life");
  assert.equal(game.state, STATE.PLAYING, "respawned");
});

test("running out of lives triggers game over", () => {
  const { game, events } = makeHarness();
  game.start();
  game.lives = 0;
  game.killPlayer();
  for (let i = 0; i < 200 && game.state !== STATE.GAMEOVER; i++) {
    game.update(1 / 60);
  }
  assert.equal(game.state, STATE.GAMEOVER);
  assert.ok(events.gameover, "onGameOver hook fired with stats");
  assert.equal(typeof events.gameover.score, "number");
});
