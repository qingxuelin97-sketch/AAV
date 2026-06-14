// All visuals are drawn procedurally with canvas primitives so the game has no
// binary asset dependencies. Drawing routines work in a local box (x, y, w, h)
// using fractional coordinates so the same art scales for small/big Mario.

const PAL = {
  red: "#e52521",
  redDark: "#a81916",
  skin: "#ffba7d",
  skinDark: "#e09356",
  brown: "#5c3a1e",
  blue: "#2a4fd6",
  blueDark: "#1b3699",
  white: "#ffffff",
  cream: "#f4f0d8",
  yellow: "#ffd23f",
  black: "#1a1a1a",
};

// Fill a rect using fractional coordinates within a box, with optional flip.
function fr(ctx, box, fx, fy, fw, fh, color, flip) {
  const { x, y, w, h } = box;
  const rx = flip ? 1 - fx - fw : fx;
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x + rx * w),
    Math.round(y + fy * h),
    Math.max(1, Math.ceil(fw * w)),
    Math.max(1, Math.ceil(fh * h))
  );
}

// --------------------------------------------------------------------------
// Mario (small / big / fire forms)
// --------------------------------------------------------------------------
export function drawMario(ctx, box, opts = {}) {
  const {
    facing = 1,
    walkFrame = 0,
    jumping = false,
    power = "small",
    invincible = false,
    star = false,
    skid = false,
  } = opts;
  const flip = facing < 0;

  // Star power cycles through bright colors.
  let cap = PAL.red;
  let overall = PAL.blue;
  let shirt = PAL.red;
  if (power === "fire") {
    cap = PAL.white;
    overall = PAL.white;
    shirt = PAL.red;
  } else if (power === "ice") {
    cap = "#7ec8ff";
    overall = PAL.white;
    shirt = "#7ec8ff";
  }
  const flowerForm = power === "fire" || power === "ice";
  if (star) {
    const k = Math.floor(performance.now() / 80) % 4;
    const cycle = ["#ff3b3b", "#ffd23f", "#5fe06b", "#5aa9ff"][k];
    cap = cycle;
    overall = cycle;
    shirt = ["#ffd23f", "#5fe06b", "#5aa9ff", "#ff3b3b"][k];
  } else if (invincible && Math.floor(performance.now() / 70) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Head / cap
  fr(ctx, box, 0.20, 0.02, 0.58, 0.10, cap, flip); // cap top
  fr(ctx, box, 0.18, 0.10, 0.16, 0.03, cap, flip); // cap back
  fr(ctx, box, 0.55, 0.10, 0.34, 0.05, cap, flip); // cap brim (front)
  // "M" emblem circle on the cap front
  fr(ctx, box, 0.60, 0.045, 0.14, 0.05, flowerForm || star ? PAL.red : PAL.white, flip);
  fr(ctx, box, 0.15, 0.11, 0.16, 0.18, PAL.brown, flip); // hair back
  fr(ctx, box, 0.30, 0.13, 0.46, 0.18, PAL.skin, flip); // face
  fr(ctx, box, 0.28, 0.13, 0.07, 0.18, PAL.brown, flip); // sideburn
  fr(ctx, box, 0.72, 0.20, 0.12, 0.09, PAL.skin, flip); // nose
  fr(ctx, box, 0.55, 0.16, 0.06, 0.07, PAL.black, flip); // eye
  fr(ctx, box, 0.44, 0.26, 0.30, 0.05, PAL.brown, flip); // mustache

  // Torso (shirt)
  fr(ctx, box, 0.22, 0.31, 0.56, 0.22, shirt, flip);
  // Overalls
  fr(ctx, box, 0.28, 0.40, 0.44, 0.30, overall, flip);
  fr(ctx, box, 0.30, 0.31, 0.08, 0.12, overall, flip); // strap L
  fr(ctx, box, 0.60, 0.31, 0.08, 0.12, overall, flip); // strap R
  fr(ctx, box, 0.33, 0.44, 0.06, 0.06, PAL.yellow, flip); // button
  fr(ctx, box, 0.60, 0.44, 0.06, 0.06, PAL.yellow, flip); // button

  if (skid && !jumping) {
    // Skid pose: front arm out, leaning back.
    fr(ctx, box, 0.74, 0.30, 0.16, 0.12, shirt, flip);
    fr(ctx, box, 0.84, 0.30, 0.10, 0.08, PAL.skin, flip);
    fr(ctx, box, 0.30, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.52, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.24, 0.84, 0.26, 0.14, PAL.brown, flip);
    fr(ctx, box, 0.52, 0.84, 0.26, 0.14, PAL.brown, flip);
  } else if (jumping) {
    fr(ctx, box, 0.74, 0.22, 0.13, 0.16, shirt, flip); // raised arm
    fr(ctx, box, 0.74, 0.16, 0.13, 0.08, PAL.skin, flip); // raised hand
    fr(ctx, box, 0.10, 0.40, 0.12, 0.18, shirt, flip); // back arm
    fr(ctx, box, 0.10, 0.56, 0.12, 0.07, PAL.skin, flip); // back hand
    fr(ctx, box, 0.30, 0.66, 0.18, 0.18, overall, flip); // legs tucked
    fr(ctx, box, 0.52, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.26, 0.80, 0.24, 0.14, PAL.brown, flip);
    fr(ctx, box, 0.52, 0.80, 0.24, 0.14, PAL.brown, flip);
  } else {
    fr(ctx, box, 0.12, 0.34, 0.11, 0.20, shirt, flip);
    fr(ctx, box, 0.12, 0.52, 0.11, 0.07, PAL.skin, flip);
    fr(ctx, box, 0.77, 0.34, 0.11, 0.20, shirt, flip);
    fr(ctx, box, 0.77, 0.52, 0.11, 0.07, PAL.skin, flip);
    const stride = walkFrame === 1 ? 0.06 : walkFrame === 2 ? -0.06 : 0;
    fr(ctx, box, 0.28 - stride, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.54 + stride, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.22 - stride, 0.84, 0.24, 0.14, PAL.brown, flip);
    fr(ctx, box, 0.54 + stride, 0.84, 0.24, 0.14, PAL.brown, flip);
  }

  ctx.globalAlpha = 1;
}

// --------------------------------------------------------------------------
// Goomba
// --------------------------------------------------------------------------
export function drawGoomba(ctx, box, opts = {}) {
  const { walkFrame = 0, squashed = false } = opts;
  if (squashed) {
    fr(ctx, box, 0.05, 0.72, 0.9, 0.28, "#8b5a2b");
    fr(ctx, box, 0.1, 0.72, 0.8, 0.08, "#6b3e1d");
    fr(ctx, box, 0.28, 0.82, 0.12, 0.06, "#3a2410");
    fr(ctx, box, 0.6, 0.82, 0.12, 0.06, "#3a2410");
    return;
  }
  fr(ctx, box, 0.12, 0.10, 0.76, 0.45, "#9c5a2b");
  fr(ctx, box, 0.05, 0.25, 0.9, 0.35, "#9c5a2b");
  fr(ctx, box, 0.05, 0.20, 0.9, 0.06, "#7a431c");
  fr(ctx, box, 0.2, 0.45, 0.6, 0.25, "#d9a066");
  const ex = walkFrame ? 0.02 : 0;
  fr(ctx, box, 0.26 + ex, 0.34, 0.12, 0.16, PAL.white);
  fr(ctx, box, 0.62 - ex, 0.34, 0.12, 0.16, PAL.white);
  fr(ctx, box, 0.32 + ex, 0.38, 0.05, 0.1, PAL.black);
  fr(ctx, box, 0.63 - ex, 0.38, 0.05, 0.1, PAL.black);
  fr(ctx, box, 0.24, 0.30, 0.18, 0.05, PAL.black);
  fr(ctx, box, 0.58, 0.30, 0.18, 0.05, PAL.black);
  if (walkFrame) {
    fr(ctx, box, 0.1, 0.85, 0.3, 0.15, "#3a2410");
    fr(ctx, box, 0.6, 0.85, 0.3, 0.15, "#3a2410");
  } else {
    fr(ctx, box, 0.18, 0.85, 0.3, 0.15, "#3a2410");
    fr(ctx, box, 0.52, 0.85, 0.3, 0.15, "#3a2410");
  }
}

// --------------------------------------------------------------------------
// Koopa Troopa (+ shell mode)
// --------------------------------------------------------------------------
export function drawKoopa(ctx, box, opts = {}) {
  const { walkFrame = 0, facing = 1, shell = false, spinning = false } = opts;
  const flip = facing < 0;

  if (shell) {
    fr(ctx, box, 0.1, 0.35, 0.8, 0.5, "#3aa14b");
    fr(ctx, box, 0.15, 0.3, 0.7, 0.12, "#2c7a39");
    fr(ctx, box, 0.2, 0.45, 0.6, 0.3, "#8fe07a");
    fr(ctx, box, 0.48, 0.35, 0.04, 0.5, "#2c7a39");
    fr(ctx, box, 0.2, 0.58, 0.6, 0.04, "#2c7a39");
    fr(ctx, box, 0.32, 0.46, 0.04, 0.2, "#2c7a39");
    fr(ctx, box, 0.64, 0.46, 0.04, 0.2, "#2c7a39");
    if (spinning) {
      const t = Math.floor(performance.now() / 50) % 2;
      fr(ctx, box, t ? 0.06 : 0.86, 0.5, 0.1, 0.2, PAL.white);
    }
    return;
  }

  fr(ctx, box, 0.18, 0.28, 0.64, 0.5, "#3aa14b", flip);
  fr(ctx, box, 0.24, 0.34, 0.5, 0.32, "#8fe07a", flip);
  fr(ctx, box, 0.62, 0.12, 0.28, 0.26, "#f5d000", flip);
  fr(ctx, box, 0.80, 0.20, 0.07, 0.07, PAL.black, flip);
  fr(ctx, box, 0.6, 0.30, 0.30, 0.06, "#d9a066", flip);
  if (walkFrame) {
    fr(ctx, box, 0.2, 0.82, 0.22, 0.18, "#f5d000", flip);
    fr(ctx, box, 0.55, 0.82, 0.22, 0.18, "#f5d000", flip);
  } else {
    fr(ctx, box, 0.28, 0.82, 0.22, 0.18, "#f5d000", flip);
    fr(ctx, box, 0.62, 0.82, 0.22, 0.18, "#f5d000", flip);
  }
}

// --------------------------------------------------------------------------
// Piranha Plant
// --------------------------------------------------------------------------
export function drawPiranha(ctx, box, opts = {}) {
  const mouth = opts.mouthOpen ? 0.06 : 0.0;
  // stem
  fr(ctx, box, 0.42, 0.45, 0.16, 0.55, "#2e9c2e");
  fr(ctx, box, 0.46, 0.45, 0.06, 0.55, "#6fe06f");
  // leaves
  fr(ctx, box, 0.20, 0.55, 0.22, 0.1, "#2e9c2e");
  fr(ctx, box, 0.58, 0.55, 0.22, 0.1, "#2e9c2e");
  // head (red with white spots)
  fr(ctx, box, 0.2, 0.06, 0.6, 0.4, "#e52521");
  fr(ctx, box, 0.12, 0.16, 0.76, 0.22, "#e52521");
  fr(ctx, box, 0.28, 0.12, 0.1, 0.1, PAL.white);
  fr(ctx, box, 0.6, 0.12, 0.1, 0.1, PAL.white);
  fr(ctx, box, 0.45, 0.26, 0.1, 0.1, PAL.white);
  // mouth
  fr(ctx, box, 0.24, 0.34 + mouth, 0.52, 0.08, PAL.white);
}

// --------------------------------------------------------------------------
// Power-ups
// --------------------------------------------------------------------------
export function drawMushroom(ctx, box, opts = {}) {
  const oneUp = opts.oneUp;
  const capColor = oneUp ? "#3aa14b" : "#e52521";
  fr(ctx, box, 0.28, 0.5, 0.44, 0.5, "#ffe9c7");
  fr(ctx, box, 0.34, 0.62, 0.1, 0.18, "#5c3a1e");
  fr(ctx, box, 0.56, 0.62, 0.1, 0.18, "#5c3a1e");
  fr(ctx, box, 0.1, 0.12, 0.8, 0.42, capColor);
  fr(ctx, box, 0.05, 0.3, 0.9, 0.22, capColor);
  fr(ctx, box, 0.18, 0.2, 0.18, 0.18, PAL.white);
  fr(ctx, box, 0.62, 0.2, 0.18, 0.18, PAL.white);
  fr(ctx, box, 0.42, 0.34, 0.16, 0.14, PAL.white);
}

export function drawFireFlower(ctx, box) {
  // stem + leaves
  fr(ctx, box, 0.44, 0.55, 0.12, 0.45, "#2e9c2e");
  fr(ctx, box, 0.22, 0.6, 0.2, 0.1, "#2e9c2e");
  fr(ctx, box, 0.58, 0.6, 0.2, 0.1, "#2e9c2e");
  // petals
  fr(ctx, box, 0.3, 0.08, 0.4, 0.12, "#ff8a3a");
  fr(ctx, box, 0.18, 0.2, 0.64, 0.12, "#ff8a3a");
  fr(ctx, box, 0.18, 0.4, 0.64, 0.12, "#ff8a3a");
  fr(ctx, box, 0.3, 0.5, 0.4, 0.1, "#ff8a3a");
  // face center
  fr(ctx, box, 0.32, 0.22, 0.36, 0.26, "#ffe87a");
  fr(ctx, box, 0.4, 0.28, 0.06, 0.08, PAL.black);
  fr(ctx, box, 0.56, 0.28, 0.06, 0.08, PAL.black);
}

export function drawStar(ctx, box, t = 0) {
  const k = Math.floor(t * 12) % 2;
  const c = k ? "#fff07a" : "#ffd23f";
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.min(w, h) * 0.5;
  ctx.save();
  ctx.fillStyle = c;
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : R * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // little eyes
  ctx.fillStyle = PAL.black;
  ctx.fillRect(cx - R * 0.28, cy, 3, 5);
  ctx.fillRect(cx + R * 0.18, cy, 3, 5);
  ctx.restore();
}

export function drawIceFlower(ctx, box) {
  fr(ctx, box, 0.44, 0.55, 0.12, 0.45, "#2e9c2e");
  fr(ctx, box, 0.22, 0.6, 0.2, 0.1, "#2e9c2e");
  fr(ctx, box, 0.58, 0.6, 0.2, 0.1, "#2e9c2e");
  fr(ctx, box, 0.3, 0.08, 0.4, 0.12, "#7ec8ff");
  fr(ctx, box, 0.18, 0.2, 0.64, 0.12, "#aee4ff");
  fr(ctx, box, 0.18, 0.4, 0.64, 0.12, "#aee4ff");
  fr(ctx, box, 0.3, 0.5, 0.4, 0.1, "#7ec8ff");
  fr(ctx, box, 0.32, 0.22, 0.36, 0.26, "#e8f7ff");
  fr(ctx, box, 0.4, 0.28, 0.06, 0.08, PAL.black);
  fr(ctx, box, 0.56, 0.28, 0.06, 0.08, PAL.black);
}

export function drawFireball(ctx, box, t = 0, type = "fire") {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 12);
  ctx.fillStyle = type === "ice" ? "#3aa6ff" : "#ff6a00";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = type === "ice" ? "#dff3ff" : "#ffe000";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ice block overlay drawn over a frozen enemy.
export function drawFrozenOverlay(ctx, box) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.fillStyle = "rgba(150, 220, 255, 0.45)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(x + 2, y + 2, 3, h - 6);
  ctx.fillRect(x + w - 5, y + 4, 2, h - 8);
  ctx.restore();
}

// The bridge axe — touch to defeat the boss.
export function drawAxe(ctx, box) {
  const { x, y, w, h } = box;
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(x + w * 0.45, y + h * 0.3, w * 0.1, h * 0.7); // handle
  ctx.fillStyle = "#d6d6d6";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.05);
  ctx.lineTo(x + w * 0.95, y + h * 0.3);
  ctx.lineTo(x + w * 0.5, y + h * 0.45);
  ctx.lineTo(x + w * 0.05, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a8a8a";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Bowser — the big spiky boss.
export function drawBowser(ctx, box, opts = {}) {
  const { facing = -1, walkFrame = 0, hurt = false, dead = false } = opts;
  const flip = facing > 0;
  if (hurt && Math.floor(performance.now() / 60) % 2 === 0) ctx.globalAlpha = 0.5;
  if (dead) {
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.rotate(Math.PI);
    box = { x: -box.w / 2, y: -box.h / 2, w: box.w, h: box.h };
  }

  // tail
  fr(ctx, box, 0.0, 0.55, 0.16, 0.12, "#3aa14b", flip);
  // legs
  fr(ctx, box, 0.2, 0.82, 0.18, 0.18, "#e0b84a", flip);
  fr(ctx, box, 0.55, 0.82, 0.18, 0.18, "#e0b84a", flip);
  fr(ctx, box, 0.2, 0.95, 0.2, 0.05, "#caa23a", flip); // claws
  fr(ctx, box, 0.55, 0.95, 0.2, 0.05, "#caa23a", flip);
  // shell (green) with spikes
  fr(ctx, box, 0.12, 0.42, 0.62, 0.42, "#2e8b3a", flip);
  fr(ctx, box, 0.18, 0.46, 0.5, 0.3, "#8fe07a", flip);
  for (let i = 0; i < 4; i++) {
    fr(ctx, box, 0.16 + i * 0.15, 0.36, 0.08, 0.1, "#f4f0d8", flip); // back spikes
  }
  // belly
  fr(ctx, box, 0.55, 0.5, 0.3, 0.34, "#ffe9a8", flip);
  // arms
  fr(ctx, box, 0.66, 0.5, 0.16, 0.2, "#e0b84a", flip);
  // head
  fr(ctx, box, 0.6, 0.16, 0.34, 0.3, "#e0b84a", flip);
  fr(ctx, box, 0.62, 0.1, 0.3, 0.12, "#b03a2a", flip); // red hair
  fr(ctx, box, 0.6, 0.06, 0.08, 0.1, "#f4f0d8", flip); // horn
  fr(ctx, box, 0.86, 0.06, 0.08, 0.1, "#f4f0d8", flip); // horn
  fr(ctx, box, 0.82, 0.22, 0.06, 0.07, PAL.black, flip); // eye
  fr(ctx, box, 0.74, 0.38, 0.22, 0.06, "#f4f0d8", flip); // teeth
  // walking foot shuffle
  if (walkFrame) fr(ctx, box, 0.2, 0.9, 0.18, 0.05, "#caa23a", flip);

  ctx.globalAlpha = 1;
  if (dead) ctx.restore();
}

export function drawCoin(ctx, box, t = 0) {
  const phase = (Math.sin(t * 6) + 1) / 2;
  const ww = 0.2 + 0.6 * phase;
  const cx = 0.5 - ww / 2;
  fr(ctx, box, cx, 0.05, ww, 0.9, "#f5c518");
  fr(ctx, box, cx + ww * 0.25, 0.2, ww * 0.5, 0.6, "#ffe87a");
  if (phase > 0.4) fr(ctx, box, 0.46, 0.3, 0.08, 0.4, "#b8860b");
}

export function drawPopup(ctx, x, y, text, color = "#fff") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.font = "bold 14px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}
