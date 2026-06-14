import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../public/js/game.js";
import { STATE, TILE } from "../public/js/constants.js";
import { LEVELS } from "../public/js/levels.js";
import { Goomba, BossFireball } from "../public/js/entities.js";

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

function makeGame() {
  const canvas = { getContext: () => makeCtx() };
  const input = { state: { left: false, right: false, jump: false, run: false }, consume: () => false, flush: () => {} };
  const audio = new Proxy({}, { get: () => () => {} });
  const game = new Game(canvas, input, audio, { onHud: () => {}, onPause: () => {} });
  return game;
}

const FINAL_INDEX = LEVELS.length - 1; // two-phase Bowser
const MINI_INDEX = LEVELS.findIndex((l) => l.bossType === "mini");

function loadBoss(game, index = FINAL_INDEX) {
  game.reset();
  game.loadLevel(index);
  game.state = STATE.PLAYING;
  return game.boss;
}

function hitBoss(game, boss) {
  game.fireballs = [];
  game.spawnFireball(game.player);
  const fb = game.fireballs[0];
  fb.x = boss.x;
  fb.y = boss.y;
  boss.invuln = 0; // skip i-frames for the test
  game.handleFireballCollisions();
}

test("the final level spawns a two-phase boss with the boss theme", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  assert.ok(boss, "Bowser exists in the boss arena");
  assert.equal(game.themeName, "boss");
  assert.equal(boss.maxPhase, 2);
  assert.equal(boss.hp, boss.hpPerPhase);
});

test("the boss enrages into phase 2 before it can be defeated", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  game.player.setPower("fire");
  for (let i = 0; i < boss.hpPerPhase; i++) hitBoss(game, boss);
  assert.equal(boss.state, "alive", "still alive after phase 1");
  assert.equal(boss.phase, 2, "entered phase 2");
  assert.ok(boss.enraged, "boss is enraged");

  for (let i = 0; i < boss.hpPerPhase; i++) hitBoss(game, boss);
  assert.equal(boss.state, "dead", "defeated after both phases");
  assert.equal(game.state, STATE.LEVEL_CLEAR);

  for (let i = 0; i < 300 && game.state !== STATE.WIN; i++) game.update(1 / 60);
  assert.equal(game.state, STATE.WIN, "beating Bowser wins the game");
});

test("the mini-boss has less health and advances to the next level", () => {
  const game = makeGame();
  const boss = loadBoss(game, MINI_INDEX);
  assert.equal(boss.maxPhase, 1);
  assert.equal(boss.hpPerPhase, 4);
  game.player.setPower("fire");
  for (let i = 0; i < 4; i++) hitBoss(game, boss);
  assert.equal(boss.state, "dead");
  for (let i = 0; i < 300 && game.state === STATE.LEVEL_CLEAR; i++) game.update(1 / 60);
  assert.ok(game.levelIndex > MINI_INDEX, "advanced past the mini-boss");
});

test("touching the axe instantly defeats the boss", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  const axe = game.entities.find((e) => e.kind === "axe");
  assert.ok(axe, "axe exists");
  game.player.x = axe.x;
  game.player.y = axe.y;
  game.handleBossCollisions();
  assert.ok(game.bossDefeated, "axe ends the fight");
  assert.equal(boss.state, "dead");
});

test("the boss damages the player on contact (no stomping Bowser)", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  game.player.setPower("big");
  game.player.x = boss.x;
  game.player.y = boss.y;
  game.player.vy = 200; // falling onto him
  game.handleBossCollisions();
  assert.equal(game.player.power, "small", "Bowser is spiky — took damage");
});

test("boss fire breath hurts the player", () => {
  const game = makeGame();
  loadBoss(game);
  game.player.setPower("big");
  const bf = new BossFireball(game.player.x, game.player.y, -100, 0);
  game.bossFireballs.push(bf);
  game.handleBossCollisions();
  assert.equal(game.player.power, "small");
  assert.ok(bf.dead, "the fireball is consumed");
});

test("an ice projectile freezes an enemy instead of flipping it", () => {
  const game = makeGame();
  game.reset();
  game.loadLevel(0);
  game.state = STATE.PLAYING;
  game.player.setPower("ice");
  const goomba = new Goomba(20, 0);
  game.entities.push(goomba);
  game.spawnFireball(game.player);
  const fb = game.fireballs[0];
  assert.equal(fb.type, "ice");
  fb.x = goomba.x;
  fb.y = goomba.y;
  game.handleFireballCollisions();
  assert.equal(goomba.state, "frozen", "enemy frozen solid");

  // A frozen enemy shatters on contact and doesn't hurt Mario.
  game.player.x = goomba.x;
  game.player.y = goomba.y;
  game.handleEnemyCollisions();
  assert.ok(goomba.dead, "frozen enemy shattered on touch");
  assert.ok(game.player.alive, "player unharmed by a frozen enemy");
});
