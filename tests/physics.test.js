import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/js/world.js";
import { Player, Goomba } from "../public/js/entities.js";
import { TILE } from "../public/js/constants.js";

// Build a tiny flat world: ground on the bottom two rows, open sky above.
function makeWorld() {
  const W = 40;
  const H = 15;
  const rows = [];
  for (let r = 0; r < H; r++) {
    rows.push(r >= H - 2 ? "X".repeat(W) : " ".repeat(W));
  }
  return new World({ name: "test", time: 400, bg: "day", flagCol: 38, tiles: rows, width: W });
}

// Minimal stand-ins for the audio engine, input and game container.
const silentAudio = new Proxy({}, { get: () => () => {} });

function makeInput(state = {}) {
  const base = { left: false, right: false, jump: false, run: false };
  return {
    state: { ...base, ...state },
    consume: () => false,
  };
}

function makeGame(audio = silentAudio) {
  return {
    audio,
    killedPit: false,
    killPlayer() {
      this.killedPit = true;
    },
  };
}

test("player falls under gravity and lands on the ground", () => {
  const world = makeWorld();
  const player = new Player(5 * TILE, 0); // spawned in the air
  const input = makeInput();
  const game = makeGame();

  for (let i = 0; i < 200; i++) player.update(1 / 60, input, world, game);

  const groundTop = (world.rows - 2) * TILE;
  assert.ok(player.onGround, "player should be grounded");
  assert.equal(player.y + player.h, groundTop, "feet rest on ground surface");
});

test("holding right moves the player rightward", () => {
  const world = makeWorld();
  const player = new Player(2 * TILE, (world.rows - 3) * TILE);
  const input = makeInput({ right: true });
  const game = makeGame();
  const startX = player.x;
  for (let i = 0; i < 60; i++) player.update(1 / 60, input, world, game);
  assert.ok(player.x > startX + TILE, "player advanced to the right");
  assert.equal(player.facing, 1, "facing right");
});

test("a wall stops horizontal movement", () => {
  const world = makeWorld();
  // Put a solid column at col 6.
  for (let r = 0; r < world.rows; r++) world.setTile(6, r, "X");
  const player = new Player(4 * TILE, (world.rows - 3) * TILE);
  const input = makeInput({ right: true });
  const game = makeGame();
  for (let i = 0; i < 120; i++) player.update(1 / 60, input, world, game);
  assert.ok(player.x + player.w <= 6 * TILE, "player blocked by the wall");
});

test("growing to big then shrinking preserves the feet position", () => {
  const world = makeWorld();
  const player = new Player(5 * TILE, (world.rows - 3) * TILE);
  const input = makeInput();
  const game = makeGame();
  for (let i = 0; i < 60; i++) player.update(1 / 60, input, world, game);
  const feet = player.y + player.h;
  player.setPower("big");
  assert.equal(player.y + player.h, feet, "feet stay put when growing");
  player.setPower("small");
  assert.equal(player.y + player.h, feet, "feet stay put when shrinking");
});

test("falling into a pit kills the player", () => {
  const world = makeWorld();
  // Carve a pit by clearing the ground columns 5..8.
  for (let c = 5; c <= 8; c++) {
    world.setTile(c, world.rows - 1, " ");
    world.setTile(c, world.rows - 2, " ");
  }
  const player = new Player(6 * TILE, (world.rows - 3) * TILE);
  const input = makeInput();
  const game = makeGame();
  for (let i = 0; i < 300 && !game.killedPit; i++) {
    player.update(1 / 60, input, world, game);
  }
  assert.ok(game.killedPit, "player died after falling into the pit");
});

test("a goomba turns around at a ledge", () => {
  const world = makeWorld();
  // Clear ground from col 0..3 so the goomba (starting at col 8 moving left)
  // would reach a ledge around col 4.
  for (let c = 0; c <= 3; c++) {
    world.setTile(c, world.rows - 1, " ");
    world.setTile(c, world.rows - 2, " ");
  }
  const goomba = new Goomba(8, world.rows - 3);
  for (let i = 0; i < 600; i++) goomba.update(1 / 60, world);
  assert.ok(!goomba.dead, "goomba should not fall into the void");
  assert.ok(goomba.x > 3 * TILE, "goomba stayed on the platform");
});
