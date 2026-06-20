import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../public/js/game.js";
import { TILE } from "../public/js/constants.js";
import {
  Mushroom,
  FireFlower,
  SuperLeaf,
  BoomerangFlower,
  Star,
  Goomba,
  Spiny,
  Paratroopa,
  PiranhaPlant,
} from "../public/js/entities.js";
import { TAIL_GLIDE_VY } from "../public/js/constants.js";

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

test("stomping a Spiny hurts the player (can't be stomped)", () => {
  const game = makeGame();
  game.player.setPower("big");
  const spiny = new Spiny(20, 0);
  spiny.x = game.player.x;
  spiny.y = game.player.y;
  game.player.vy = 200; // coming down on it
  game.entities.push(spiny);
  game.handleEnemyCollisions();
  assert.equal(game.player.power, "small", "spikes shrank big Mario");
  assert.equal(spiny.state, "walk", "the Spiny is unharmed by the stomp");
});

test("a fireball flips a Spiny", () => {
  const game = makeGame();
  game.player.setPower("fire");
  const spiny = new Spiny(20, 0);
  game.entities.push(spiny);
  game.spawnFireball(game.player);
  const fb = game.fireballs[0];
  fb.x = spiny.x;
  fb.y = spiny.y;
  game.handleFireballCollisions();
  assert.equal(spiny.state, "flipped", "fireball knocks the Spiny out");
  assert.ok(fb.dead, "fireball consumed");
});

test("an iceball freezes a Spiny, which then shatters safely on touch", () => {
  const game = makeGame();
  game.player.setPower("ice");
  const spiny = new Spiny(20, 0);
  game.entities.push(spiny);
  game.spawnFireball(game.player);
  const fb = game.fireballs[0];
  fb.x = spiny.x;
  fb.y = spiny.y;
  game.handleFireballCollisions();
  assert.equal(spiny.state, "frozen", "iceball freezes the Spiny");
  game.player.x = spiny.x;
  game.player.y = spiny.y;
  game.handleEnemyCollisions();
  assert.ok(spiny.dead, "frozen Spiny shatters on contact");
  assert.ok(game.player.alive, "player unharmed by the frozen Spiny");
});

test("the Super Leaf grants the raccoon tail form", () => {
  const game = makeGame();
  const leaf = new SuperLeaf(0, 0);
  overlap(leaf, game.player);
  game.entities.push(leaf);
  game.handleItemCollisions();
  assert.equal(game.player.power, "tail");
  assert.ok(game.player.isBig, "tail form is big-sized");
});

test("the tail glide caps the player's fall speed", () => {
  const game = makeGame();
  game.player.setPower("tail");
  game.player.onGround = false;
  game.player.vy = 600; // plummeting
  const input = { state: { jump: true, left: false, right: false, run: false }, consume: () => false };
  game.player.update(1 / 60, input, game.world, game);
  assert.ok(game.player.vy <= TAIL_GLIDE_VY + 1, "glide slowed the fall");
});

test("the Boomerang Flower grants the boomerang form and throws return-hitting boomerangs", () => {
  const game = makeGame();
  const flower = new BoomerangFlower(0, 0);
  overlap(flower, game.player);
  game.entities.push(flower);
  game.handleItemCollisions();
  assert.equal(game.player.power, "boomerang");

  assert.equal(game.spawnBoomerang(game.player), true, "throws one");
  assert.equal(game.spawnBoomerang(game.player), false, "only one boomerang at a time");

  const goomba = new Goomba(20, 0);
  game.entities.push(goomba);
  const bm = game.boomerangs[0];
  bm.x = goomba.x;
  bm.y = goomba.y;
  game.handleBoomerangCollisions();
  assert.equal(goomba.state, "flipped", "boomerang knocks the enemy out");
  assert.ok(!bm.dead, "boomerang passes through (does not pop on a hit)");
});

test("a tail-spin flips a nearby enemy", () => {
  const game = makeGame();
  game.player.setPower("tail");
  const goomba = new Goomba(0, 0);
  goomba.x = game.player.x + game.player.w + 4;
  goomba.y = game.player.y;
  game.entities.push(goomba);
  game.tailSpin(game.player);
  assert.equal(goomba.state, "flipped", "tail whip knocked it away");
});

test("stomping a Paratroopa shears its wings into a walking Koopa", () => {
  const game = makeGame();
  const para = new Paratroopa(20, 0);
  para.x = game.player.x;
  para.y = game.player.y + 12; // sitting just below Mario's feet
  game.player.vy = 200; // descending onto it
  game.entities.push(para);
  game.handleEnemyCollisions();
  assert.ok(para.dead, "the winged form is removed");
  assert.ok(game.entities.some((e) => e.constructor.name === "Koopa"), "a ground Koopa dropped");
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
