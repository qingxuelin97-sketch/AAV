// Procedural rendering of parallax backgrounds and the tile world.

import { TILE, VIEW_W, VIEW_H, T } from "./constants.js";
import { drawCoin } from "./sprites.js";

const SKY = {
  day: ["#5c94fc", "#8fc0ff"],
  dusk: ["#3a2a6b", "#ff8a5c"],
  night: ["#0a0a2a", "#1a1a4a"],
  snow: ["#8fb8e8", "#dceaf7"],
  cave: ["#0c1418", "#142730"],
  castle: ["#1a0d12", "#3a1416"],
};

// Deterministic pseudo-random for stable decoration placement.
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function drawBackground(ctx, cam, def, time = 0) {
  const colors = SKY[def.bg] || SKY.day;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (def.bg === "castle") {
    // Distant dark pillars + a glowing lava band at the bottom.
    drawCastleBg(ctx, cam, time);
    drawScenery(ctx, cam, def);
    return;
  }

  if (def.bg === "snow") {
    drawHills(ctx, cam, def);
    drawScenery(ctx, cam, def);
    drawSnow(ctx, time);
    return;
  }

  if (def.bg === "cave") {
    drawCaveBg(ctx, cam, def, time);
    return;
  }

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
  // Foreground scenery (bushes / fences) just above the ground line.
  drawScenery(ctx, cam, def);
}

function drawScenery(ctx, cam, def) {
  const offset = cam.x * 0.8;
  const baseY = VIEW_H - TILE * 2;
  const r = rng(def.width * 11 + 5);
  const bush = def.bg === "night" ? "#1f6e3a" : def.bg === "dusk" ? "#7a4a8a" : "#43c043";
  const bushDark = def.bg === "night" ? "#155029" : def.bg === "dusk" ? "#5a3568" : "#2e8b2e";
  for (let i = 0; i < def.width / 6; i++) {
    const baseX = i * 6 * TILE + r() * 120;
    const sx = baseX - offset;
    if (sx < -120 || sx > VIEW_W + 120) {
      r(); // keep the sequence advancing for stability
      continue;
    }
    if (r() > 0.5) {
      bushShape(ctx, sx, baseY, bush, bushDark);
    } else {
      fenceShape(ctx, sx, baseY, def.bg === "night" ? "#9a9a9a" : "#e8e8e8");
    }
  }
}

function bushShape(ctx, x, baseY, color, dark) {
  ctx.fillStyle = dark;
  ctx.fillRect(x - 36, baseY - 6, 72, 8);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - 24, baseY - 4, 16, Math.PI, 0);
  ctx.arc(x, baseY - 4, 22, Math.PI, 0);
  ctx.arc(x + 24, baseY - 4, 16, Math.PI, 0);
  ctx.fill();
}

function fenceShape(ctx, x, baseY, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const px = x + i * 12;
    ctx.fillRect(px, baseY - 22, 6, 22);
    ctx.strokeRect(px + 0.5, baseY - 22.5, 6, 22);
  }
  ctx.fillRect(x, baseY - 16, 42, 5);
}

// A single firework burst for the level-clear celebration.
export function drawFirework(ctx, x, y, t, color) {
  const rad = 8 + t * 60;
  const alpha = Math.max(0, 1 - t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Falling snow, animated with time and gently drifting.
function drawSnow(ctx, time) {
  const r = rng(99173);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 90; i++) {
    const baseX = r() * VIEW_W;
    const speed = 20 + r() * 40;
    const sway = Math.sin(time * 1.5 + i) * 12;
    const x = (baseX + sway) % VIEW_W;
    const y = (r() * VIEW_H + time * speed) % VIEW_H;
    const s = r() > 0.8 ? 3 : 2;
    ctx.fillRect(x, y, s, s);
  }
}

// Underground cavern: dripping stalactites/stalagmites and faint glow-crystals.
function drawCaveBg(ctx, cam, def, time) {
  const offset = cam.x * 0.45;
  const baseY = VIEW_H - TILE * 2;
  // Hanging stalactites from the ceiling.
  ctx.fillStyle = "#1b2a33";
  const spacing = 3 * TILE;
  for (let i = -1; i < def.width / 3 + 1; i++) {
    const x = i * spacing - (offset % (spacing * 4));
    const h = 26 + ((i * 53) % 40);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + TILE * 0.7, 0);
    ctx.lineTo(x + TILE * 0.35, h);
    ctx.closePath();
    ctx.fill();
    // matching stalagmite rising from the floor
    const gh = 18 + ((i * 31) % 34);
    ctx.beginPath();
    ctx.moveTo(x + TILE, baseY);
    ctx.lineTo(x + TILE + TILE * 0.7, baseY);
    ctx.lineTo(x + TILE + TILE * 0.35, baseY - gh);
    ctx.closePath();
    ctx.fill();
  }
  // Glowing crystals, twinkling with time.
  const r = rng(def.width * 17 + 3);
  for (let i = 0; i < 40; i++) {
    const x = (r() * def.width * TILE - offset);
    const sx = ((x % (def.width * TILE)) + def.width * TILE) % (def.width * TILE);
    if (sx < -20 || sx > VIEW_W + 20) continue;
    const y = 40 + r() * (VIEW_H - 160);
    const tw = 0.4 + 0.6 * ((Math.sin(time * 2 + i) + 1) / 2);
    ctx.globalAlpha = tw;
    ctx.fillStyle = i % 3 === 0 ? "#6fe0ff" : "#7affc0";
    ctx.fillRect(sx, y, 3, 5);
  }
  ctx.globalAlpha = 1;
}

// Castle interior: dark pillars and a glowing, bubbling lava strip.
function drawCastleBg(ctx, cam, time) {
  const offset = cam.x * 0.4;
  ctx.fillStyle = "#241016";
  const spacing = 5 * TILE;
  for (let i = -1; i < VIEW_W / spacing + 3; i++) {
    const x = i * spacing - (offset % (spacing * 3));
    ctx.fillRect(x, 0, TILE * 1.4, VIEW_H - TILE * 2);
    ctx.fillStyle = "#1a0b10";
    for (let b = 0; b < VIEW_H / 24; b++) ctx.fillRect(x, b * 24, TILE * 1.4, 2);
    ctx.fillStyle = "#241016";
  }
  // Lava glow band near the bottom.
  const lavaY = VIEW_H - TILE;
  const grad = ctx.createLinearGradient(0, lavaY - 20, 0, VIEW_H);
  grad.addColorStop(0, "rgba(255,90,20,0.0)");
  grad.addColorStop(1, "rgba(255,120,30,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, lavaY - 20, VIEW_W, TILE + 20);
  ctx.fillStyle = "#ff7a1e";
  for (let i = 0; i < VIEW_W; i += 24) {
    const h = 4 + Math.sin(time * 4 + i) * 3 + 4;
    ctx.fillRect(i, VIEW_H - h, 18, h);
  }
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
    case T.QBLOCK_ICE:
    case T.QBLOCK_LEAF:
    case T.QBLOCK_BOOM:
    case T.QBLOCK_STAR:
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

const GROUND_THEME = {
  day: { fill: "#c8530f", stud: "#9c3d08", lt: "#e07a34", dk: "#7a2c05", top: "#3aae3a", top2: "#2e8b2e" },
  dusk: { fill: "#9a4a6a", stud: "#7a3550", lt: "#b86a86", dk: "#5c2640", top: "#7a4a8a", top2: "#5c3568" },
  night: { fill: "#3a3550", stud: "#2a2640", lt: "#5a5170", dk: "#1f1c30", top: "#2f5a3a", top2: "#214a2c" },
  snow: { fill: "#a8c4dc", stud: "#8aa8c4", lt: "#d0e4f2", dk: "#6a8aa6", top: "#ffffff", top2: "#d8ebf7" },
  cave: { fill: "#3a4a52", stud: "#2a363c", lt: "#52656e", dk: "#1c262b", top: "#2f6a5a", top2: "#214a3e" },
  castle: { fill: "#4a4458", stud: "#332f42", lt: "#665f78", dk: "#221f2e", top: null, top2: null },
};

function groundBlock(ctx, x, y, world, col, row) {
  const th = GROUND_THEME[world.def.bg] || GROUND_THEME.day;
  const grassTop = th.top && !world.isSolid(col, row - 1) && world.tile(col, row - 1) !== T.COIN;
  ctx.fillStyle = th.fill;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.stud;
  ctx.fillRect(x + 4, y + 6, TILE - 8, 4);
  ctx.fillRect(x + 4, y + TILE - 10, TILE - 8, 4);
  bevel(ctx, x, y, th.lt, th.dk);
  if (grassTop) {
    ctx.fillStyle = th.top;
    ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = th.top2;
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
  // The pipe lip: a green cap with a bright highlight on the left tile.
  ctx.fillStyle = "#2e9c2e";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#6fe06f";
  if (left) ctx.fillRect(x, y, 4, TILE); // vertical highlight on the left edge
  ctx.fillRect(x, y, TILE, 4); // top-lip highlight
  ctx.fillStyle = "#1c6e1c";
  ctx.fillRect(x, y + 8, TILE, 2); // groove under the lip
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
