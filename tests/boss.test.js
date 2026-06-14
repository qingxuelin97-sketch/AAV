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

const BOSS_INDEX = LEVELS.findIndex((l) => l.boss);

function loadBoss(game) {
  game.reset();
  game.loadLevel(BOSS_INDEX);
  game.state = STATE.PLAYING;
  return game.boss;
}

test("the final level spawns a boss and uses the boss theme", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  assert.ok(boss, "Bowser exists in the boss arena");
  assert.equal(game.themeName, "boss");
  assert.equal(boss.hp, 5);
});

test("five projectile hits defeat the boss and win the game", () => {
  const game = makeGame();
  const boss = loadBoss(game);
  game.player.setPower("fire");
  for (let i = 0; i < 5; i++) {
    game.fireballs = [];
    game.spawnFireball(game.player);
    const fb = game.fireballs[0];
    fb.x = boss.x;
    fb.y = boss.y;
    boss.invuln = 0; // skip i-frames for the test
    game.handleFireballCollisions();
  }
  assert.equal(boss.state, "dead", "boss defeated");
  assert.ok(game.bossDefeated, "defeat sequence triggered");
  assert.equal(game.state, STATE.LEVEL_CLEAR);

  // Celebration then win (boss level is the finale).
  for (let i = 0; i < 300 && game.state !== STATE.WIN; i++) game.update(1 / 60);
  assert.equal(game.state, STATE.WIN, "clearing the boss wins the game");
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
