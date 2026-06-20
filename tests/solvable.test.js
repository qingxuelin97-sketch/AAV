// Proves every non-boss level is completable: a heuristic "auto-pilot" runs
// right (using the REAL physics + collision) and jumps over pits, walls and
// enemies. If it reaches the flag, a human comfortably can too. Any level it
// can't clear fails this test — so levels can't ship un-runnable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../public/js/game.js";
import { STATE, TILE } from "../public/js/constants.js";
import { LEVELS } from "../public/js/levels.js";
import { Goomba, Koopa, Spiny, Paratroopa } from "../public/js/entities.js";

function makeCtx() {
  const ctx = {
    canvas: { width: 960, height: 480 },
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 }),
  };
  for (const m of [
    "clearRect", "fillRect", "strokeRect", "beginPath", "arc", "rect", "fill",
    "stroke", "moveTo", "lineTo", "quadraticCurveTo", "closePath", "save",
    "restore", "translate", "scale", "rotate", "fillText", "strokeText",
  ]) ctx[m] = () => {};
  return ctx;
}

function autoInput() {
  return {
    state: { left: false, right: true, jump: false, run: true, item: false },
    _edges: new Set(),
    consume(a) {
      if (this._edges.has(a)) {
        this._edges.delete(a);
        return true;
      }
      return false;
    },
    flush() {},
    press(a) {
      this._edges.add(a);
    },
  };
}

function makeGame(input) {
  const canvas = { getContext: () => makeCtx() };
  const audio = new Proxy({}, { get: () => () => {} });
  return new Game(canvas, input, audio, { onHud: () => {}, onPause: () => {} });
}

// Should the auto-pilot jump right now? Looks ahead for pits, walls and enemies.
function needJump(p, world, game) {
  const col = Math.floor(p.cx / TILE);
  const footRow = Math.floor((p.y + p.h + 2) / TILE);
  // Pit close ahead.
  for (let d = 1; d <= 2; d++) {
    if (!world.isSolid(col + d, footRow) && !world.isSolid(col + d, footRow + 1)) return true;
  }
  // Wall / pipe / step at body height.
  const bodyRow = Math.floor((p.y + p.h - 6) / TILE);
  for (let d = 1; d <= 2; d++) {
    if (world.isSolid(col + d, bodyRow) || world.isSolid(col + d, bodyRow - 1)) return true;
  }
  // Enemy just ahead.
  for (const e of game.entities) {
    if (!(e instanceof Goomba || e instanceof Koopa || e instanceof Spiny || e instanceof Paratroopa))
      continue;
    if (e.state === "squashed" || e.state === "frozen" || e.state === "flipped") continue;
    const dx = e.x - (p.x + p.w);
    if (dx > -10 && dx < TILE * 2.4 && Math.abs(e.y - p.y) < TILE * 1.6) return true;
  }
  return false;
}

function runLevel(index) {
  const input = autoInput();
  const game = makeGame(input);
  game.startAt(index);

  let jumpHold = 0;
  let maxX = 0;
  for (let frame = 0; frame < 5000; frame++) {
    const p = game.player;
    const world = game.world;

    if (game.state === STATE.PLAYING && p.onGround && jumpHold === 0 && needJump(p, world, game)) {
      input.press("jump");
      input.state.jump = true;
      jumpHold = 11;
    }
    if (jumpHold > 0) {
      jumpHold -= 1;
      if (jumpHold === 0) input.state.jump = false;
    }

    game.update(1 / 60);
    maxX = Math.max(maxX, p.x);

    if (game.state === STATE.LEVEL_CLEAR || game.levelIndex !== index) {
      return { ok: true };
    }
    if (game.state === STATE.DYING || game.state === STATE.GAMEOVER) {
      return { ok: false, diedAtTile: Math.round(maxX / TILE), reason: "died" };
    }
  }
  return { ok: false, diedAtTile: Math.round(maxX / TILE), reason: "timeout" };
}

for (let i = 0; i < LEVELS.length; i++) {
  const def = LEVELS[i];
  if (def.boss) continue; // boss arenas are verified by boss.test.js
  test(`level ${def.name} is completable by the auto-pilot`, () => {
    const res = runLevel(i);
    assert.ok(
      res.ok,
      `auto-pilot failed on ${def.name} (${res.reason}) around tile ${res.diedAtTile} of ${def.width}`
    );
  });
}
