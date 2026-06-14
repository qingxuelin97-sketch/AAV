import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../public/js/game.js";
import { TILE } from "../public/js/constants.js";
import { Mushroom, FireFlower, Star, Goomba, PiranhaPlant } from "../public/js/entities.js";

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
  game.start();
  return game;
}

// Place an item exactly on the player and run item collision.
function overlap(item, player) {
  item.x = player.x;
  item.y = player.y;
  item.emerging = 0;
}

test("mushroom grows small Mario to big", () => {
  const game = makeGame();
  assert.equal(game.player.power, "small");
  const m = new Mushroom(0, 0, false);
  overlap(m, game.player);
  game.entities.push(m);
  game.handleItemCollisions();
  assert.equal(game.player.power, "big");
});

test("the reserve item deploys a usable power-up", () => {
  const game = makeGame();
  assert.equal(game.reserve, "mushroom", "starts with a reserve mushroom");
  const before = game.entities.length;
  game.useReserve();
  assert.equal(game.entities.length, before + 1, "spawned the reserved item");
  assert.equal(game.reserve, null, "reserve is emptied after use");
});

test("fire flower turns Mario into fire form", () => {
  const game = makeGame();
  const f = new FireFlower(0, 0);
  overlap(f, game.player);
  game.entities.push(f);
  game.handleItemCollisions();
  assert.equal(game.player.power, "fire");
});

test("only fire Mario can throw fireballs, capped at two", () => {
  const game = makeGame();
  assert.equal(game.spawnFireball(game.player), true); // method itself works
  game.fireballs = [];
  game.player.setPower("fire");
  assert.equal(game.spawnFireball(game.player), true);
  assert.equal(game.spawnFireball(game.player), true);
  assert.equal(game.spawnFireball(game.player), false, "max two fireballs at once");
  assert.equal(game.fireballs.length, 2);
});

test("a star makes Mario invincible and flips enemies on contact", () => {
  const game = makeGame();
  const s = new Star(0, 0);
  overlap(s, game.player);
  game.entities.push(s);
  game.handleItemCollisions();
  assert.ok(game.player.starTime > 0, "star granted invincibility");

  const goomba = new Goomba(0, 0);
  goomba.x = game.player.x;
  goomba.y = game.player.y;
  game.entities.push(goomba);
  game.handleEnemyCollisions();
  assert.equal(goomba.state, "flipped", "enemy knocked out by star power");
  assert.ok(game.player.alive, "player unharmed while invincible");
});

test("an emerged piranha plant damages big Mario down to small", () => {
  const game = makeGame();
  game.player.setPower("big");
  const piranha = new PiranhaPlant(0, 1);
  piranha.rise = piranha.maxRise; // fully out → active
  piranha.x = game.player.x;
  piranha.y = game.player.y;
  piranha.h = piranha.maxRise;
  game.entities.push(piranha);
  game.handlePiranhaCollisions();
  assert.equal(game.player.power, "small", "took a hit and shrank");
  assert.ok(game.player.invincible > 0, "got damage i-frames");
});

test("fireball destroys a goomba", () => {
  const game = makeGame();
  game.player.setPower("fire");
  const goomba = new Goomba(20, 0);
  game.entities.push(goomba);
  game.spawnFireball(game.player);
  const fb = game.fireballs[0];
  fb.x = goomba.x;
  fb.y = goomba.y;
  game.handleFireballCollisions();
  assert.equal(goomba.state, "flipped");
  assert.ok(fb.dead, "fireball is consumed on hit");
});
