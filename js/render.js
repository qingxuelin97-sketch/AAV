// Procedural rendering of parallax backgrounds and the tile world.

import { TILE, VIEW_W, VIEW_H, T } from "./constants.js";
import { drawCoin } from "./sprites.js";

const SKY = {
  day: ["#5c94fc", "#8fc0ff"],
  dusk: ["#3a2a6b", "#ff8a5c"],
  night: ["#0a0a2a", "#1a1a4a"],
};

// Deterministic pseudo-random for stable decoration placement.
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function drawBackground(ctx, cam, def) {
  const colors = SKY[def.bg] || SKY.day;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (def.bg === "night") {
    // Stars + moon.
    const r = rng(def.width * 7 + 13);
    ctx.fillStyle = "#fffbe0";
    for (let i = 0; i < 60; i++) {
      const x = r() * VIEW_W;
      const y = r() * VIEW_H * 0.7;
      const s = r() > 0.85 ? 2 : 1;
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff7d0";
    ctx.beginPath();
    ctx.arc(VIEW_W - 110, 80, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SKY.night[0];
    ctx.beginPath();
    ctx.arc(VIEW_W - 95, 70, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parallax clouds.
  drawClouds(ctx, cam, def);
  // Parallax hills.
  drawHills(ctx, cam, def);
}

function drawClouds(ctx, cam, def) {
  const r = rng(def.width * 3 + 1);
  const count = Math.ceil(def.width / 14);
  const offset = cam.x * 0.3;
  ctx.fillStyle = def.bg === "night" ? "rgba(200,210,255,0.25)" : "rgba(255,255,255,0.9)";
  for (let i = 0; i < count; i++) {
    const baseX = i * 14 * TILE + r() * 200;
    const x = baseX - offset;
    const wrap = ((x % (def.width * TILE)) + def.width * TILE) % (def.width * TILE);
    const sx = wrap;
    if (sx < -200 || sx > VIEW_W + 200) continue;
    const y = 40 + r() * 120;
    cloud(ctx, sx, y, 0.7 + r() * 0.8);
  }
}

function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 22 * s, y - 8 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 48 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.rect(x, y, 48 * s, 18 * s);
  ctx.fill();
}

function drawHills(ctx, cam, def) {
  const offset = cam.x * 0.5;
  const baseY = VIEW_H - TILE * 2;
  const colorBack = def.bg === "night" ? "#16364a" : def.bg === "dusk" ? "#7a4a8a" : "#3aae3a";
  const colorFront = def.bg === "night" ? "#1f4a63" : def.bg === "dusk" ? "#9a5aa0" : "#2e8b2e";
  const spacing = 9 * TILE;
  for (let i = -1; i < def.width / 9 + 1; i++) {
    const x = i * spacing - (offset % (spacing * 4));
    hill(ctx, x + spacing * 2, baseY, 90, colorBack);
  }
  for (let i = -1; i < def.width / 9 + 1; i++) {
    const x = i * spacing - (offset % (spacing * 4));
    hill(ctx, x, baseY, 60, colorFront);
  }
}

function hill(ctx, x, baseY, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r, baseY);
  ctx.quadraticCurveTo(x, baseY - r * 1.4, x + r, baseY);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Tile world rendering
// ---------------------------------------------------------------------------
export function drawWorld(ctx, world, cam, time) {
  const startCol = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const endCol = Math.min(world.cols - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1);

  for (let col = startCol; col <= endCol; col++) {
    for (let row = 0; row < world.rows; row++) {
      const ch = world.tile(col, row);
      if (ch === T.EMPTY) continue;
      const x = col * TILE - cam.x;
      const y = row * TILE + world.bumpOffset(col, row);
      drawTile(ctx, ch, x, y, world, col, row, time);
    }
  }
}

function drawTile(ctx, ch, x, y, world, col, row, time) {
  switch (ch) {
    case T.GROUND:
      groundBlock(ctx, x, y, world, col, row);
      break;
    case T.BRICK:
      brickBlock(ctx, x, y);
      break;
    case T.QBLOCK_COIN:
    case T.QBLOCK_MUSH:
    case T.QBLOCK_1UP:
      questionBlock(ctx, x, y, time);
      break;
    case T.USED:
      usedBlock(ctx, x, y);
      break;
    case T.HARD:
      hardBlock(ctx, x, y);
      break;
    case T.PIPE_TL:
      pipeTop(ctx, x, y, true);
      break;
    case T.PIPE_TR:
      pipeTop(ctx, x, y, false);
      break;
    case T.PIPE_BL:
      pipeBody(ctx, x, y, true);
      break;
    case T.PIPE_BR:
      pipeBody(ctx, x, y, false);
      break;
    case T.COIN:
      drawCoin(ctx, { x: x + 6, y: y + 4, w: 20, h: 24 }, time);
      break;
    case T.FLAGPOLE:
      flagPole(ctx, x, y, world, row);
      break;
    case T.FLAGBASE:
      flagBase(ctx, x, y);
      break;
  }
}

function bevel(ctx, x, y, light, dark) {
  ctx.fillStyle = light;
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillRect(x, y, 2, TILE);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + TILE - 2, TILE, 2);
  ctx.fillRect(x + TILE - 2, y, 2, TILE);
}

function groundBlock(ctx, x, y, world, col, row) {
  const grassTop = !world.isSolid(col, row - 1) && world.tile(col, row - 1) !== T.COIN;
  ctx.fillStyle = "#c8530f";
  ctx.fillRect(x, y, TILE, TILE);
  // studs pattern
  ctx.fillStyle = "#9c3d08";
  ctx.fillRect(x + 4, y + 6, TILE - 8, 4);
  ctx.fillRect(x + 4, y + TILE - 10, TILE - 8, 4);
  bevel(ctx, x, y, "#e07a34", "#7a2c05");
  if (grassTop) {
    ctx.fillStyle = "#3aae3a";
    ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = "#2e8b2e";
    ctx.fillRect(x, y + 6, TILE, 2);
  }
}

function brickBlock(ctx, x, y) {
  ctx.fillStyle = "#c0531c";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = "#7a2c05";
  ctx.lineWidth = 2;
  // mortar lines
  ctx.beginPath();
  ctx.moveTo(x, y + TILE / 2);
  ctx.lineTo(x + TILE, y + TILE / 2);
  ctx.moveTo(x + TILE / 2, y);
  ctx.lineTo(x + TILE / 2, y + TILE / 2);
  ctx.moveTo(x, y + TILE / 2);
  ctx.lineTo(x, y + TILE / 2);
  ctx.moveTo(x + TILE / 4, y + TILE / 2);
  ctx.lineTo(x + TILE / 4, y + TILE);
  ctx.moveTo(x + (3 * TILE) / 4, y + TILE / 2);
  ctx.lineTo(x + (3 * TILE) / 4, y + TILE);
  ctx.stroke();
  bevel(ctx, x, y, "#e0763a", "#7a2c05");
}

function questionBlock(ctx, x, y, time) {
  const glow = (Math.sin(time * 4) + 1) / 2;
  ctx.fillStyle = `rgb(${230 + glow * 25}, ${170 + glow * 40}, 30)`;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, "#ffe070", "#a85a08");
  // rivets
  ctx.fillStyle = "#7a3f06";
  for (const [dx, dy] of [
    [4, 4],
    [TILE - 8, 4],
    [4, TILE - 8],
    [TILE - 8, TILE - 8],
  ]) {
    ctx.fillRect(x + dx, y + dy, 3, 3);
  }
  // "?"
  ctx.fillStyle = "#7a3f06";
  ctx.font = "bold 20px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", x + TILE / 2 + 1, y + TILE / 2 + 2);
  ctx.fillStyle = "#fff";
  ctx.fillText("?", x + TILE / 2, y + TILE / 2);
  ctx.textBaseline = "alphabetic";
}

function usedBlock(ctx, x, y) {
  ctx.fillStyle = "#9a6b3a";
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, "#c08a52", "#5c3a1e");
  ctx.fillStyle = "#5c3a1e";
  for (const [dx, dy] of [
    [4, 4],
    [TILE - 7, 4],
    [4, TILE - 7],
    [TILE - 7, TILE - 7],
  ]) {
    ctx.fillRect(x + dx, y + dy, 3, 3);
  }
}

function hardBlock(ctx, x, y) {
  ctx.fillStyle = "#b5651d";
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, "#d98a3a", "#6e3d10");
  ctx.fillStyle = "#6e3d10";
  ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
  ctx.fillStyle = "#9a531a";
  ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
}

function pipeTop(ctx, x, y, left) {
  ctx.fillStyle = "#2e9c2e";
  ctx.fillRect(x, y, TILE, TILE);
  // rim overhang
  ctx.fillStyle = "#2e9c2e";
  ctx.fillRect(x - (left ? 0 : 0), y, TILE, 10);
  ctx.fillStyle = "#6fe06f";
  ctx.fillRect(x, y, left ? 4 : TILE - 4 < 0 ? 0 : 4, TILE);
  if (left) {
    ctx.fillStyle = "#6fe06f";
    ctx.fillRect(x, y, 4, 10);
  }
  ctx.fillStyle = "#1c6e1c";
  ctx.fillRect(x, y + 8, TILE, 2);
  if (left) ctx.fillRect(x, y, 2, TILE);
  else ctx.fillRect(x + TILE - 2, y, 2, TILE);
  ctx.strokeStyle = "#0e4a0e";
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function pipeBody(ctx, x, y, left) {
  ctx.fillStyle = "#2e9c2e";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#6fe06f";
  ctx.fillRect(x + (left ? 6 : TILE - 12), y, 6, TILE);
  ctx.fillStyle = "#1c6e1c";
  if (left) ctx.fillRect(x, y, 2, TILE);
  else ctx.fillRect(x + TILE - 2, y, 2, TILE);
}

function flagPole(ctx, x, y, world, row) {
  // Ball at the very top of the pole.
  const topMost = world.tile(world.flagCol, row - 1) !== T.FLAGPOLE;
  ctx.fillStyle = "#bdbdbd";
  ctx.fillRect(x + TILE / 2 - 2, y, 4, TILE);
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(x + TILE / 2 + 1, y, 1, TILE);
  if (topMost) {
    ctx.fillStyle = "#3aa14b";
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flagBase(ctx, x, y) {
  ctx.fillStyle = "#dcdcdc";
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, "#fff", "#888");
}

// A decorative castle drawn a few tiles past the flag.
export function drawCastle(ctx, x, baseY) {
  ctx.fillStyle = "#b5403a";
  ctx.fillRect(x, baseY - TILE * 4, TILE * 5, TILE * 4);
  // battlements
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) ctx.fillRect(x + i * TILE, baseY - TILE * 4 - 12, TILE, 12);
  }
  // door
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + TILE * 2, baseY - TILE * 2, TILE, TILE * 2);
  ctx.beginPath();
  ctx.arc(x + TILE * 2.5, baseY - TILE * 2, TILE / 2, Math.PI, 0);
  ctx.fill();
  // windows
  ctx.fillRect(x + TILE * 0.6, baseY - TILE * 3, 14, 14);
  ctx.fillRect(x + TILE * 4 - 14, baseY - TILE * 3, 14, 14);
  // tower
  ctx.fillStyle = "#9a322d";
  ctx.fillRect(x + TILE * 1.8, baseY - TILE * 5.2, TILE * 1.4, TILE * 1.4);
}
