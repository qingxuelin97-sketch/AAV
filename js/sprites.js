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
  yellow: "#ffd23f",
  white: "#ffffff",
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
    Math.ceil(fw * w),
    Math.ceil(fh * h)
  );
}

// --------------------------------------------------------------------------
// Mario
// --------------------------------------------------------------------------
export function drawMario(ctx, box, opts = {}) {
  const { facing = 1, walkFrame = 0, jumping = false, big = false, invincible = false } = opts;
  const flip = facing < 0;

  // Invincibility blink.
  if (invincible && Math.floor(performance.now() / 70) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Head / cap
  fr(ctx, box, 0.20, 0.02, 0.58, 0.10, PAL.red, flip); // cap top
  fr(ctx, box, 0.18, 0.10, 0.16, 0.03, PAL.red, flip); // cap back
  fr(ctx, box, 0.55, 0.10, 0.34, 0.05, PAL.red, flip); // cap brim (front)
  fr(ctx, box, 0.15, 0.11, 0.16, 0.18, PAL.brown, flip); // hair back
  fr(ctx, box, 0.30, 0.13, 0.46, 0.18, PAL.skin, flip); // face
  fr(ctx, box, 0.28, 0.13, 0.07, 0.18, PAL.brown, flip); // sideburn
  fr(ctx, box, 0.72, 0.20, 0.12, 0.09, PAL.skin, flip); // nose
  fr(ctx, box, 0.55, 0.16, 0.06, 0.07, PAL.black, flip); // eye
  fr(ctx, box, 0.44, 0.26, 0.30, 0.05, PAL.brown, flip); // mustache

  // Torso (shirt)
  fr(ctx, box, 0.22, 0.31, 0.56, 0.22, PAL.red, flip);
  // Overalls
  fr(ctx, box, 0.28, 0.40, 0.44, 0.30, PAL.blue, flip);
  fr(ctx, box, 0.30, 0.31, 0.08, 0.12, PAL.blue, flip); // strap L
  fr(ctx, box, 0.60, 0.31, 0.08, 0.12, PAL.blue, flip); // strap R
  fr(ctx, box, 0.33, 0.44, 0.06, 0.06, PAL.yellow, flip); // button
  fr(ctx, box, 0.60, 0.44, 0.06, 0.06, PAL.yellow, flip); // button

  if (jumping) {
    // Raised front arm + tucked legs.
    fr(ctx, box, 0.74, 0.22, 0.13, 0.16, PAL.red, flip); // raised arm
    fr(ctx, box, 0.74, 0.16, 0.13, 0.08, PAL.skin, flip); // raised hand
    fr(ctx, box, 0.10, 0.40, 0.12, 0.18, PAL.red, flip); // back arm
    fr(ctx, box, 0.10, 0.56, 0.12, 0.07, PAL.skin, flip); // back hand
    fr(ctx, box, 0.30, 0.66, 0.18, 0.18, PAL.blue, flip); // leg
    fr(ctx, box, 0.52, 0.66, 0.18, 0.18, PAL.blue, flip);
    fr(ctx, box, 0.26, 0.80, 0.24, 0.14, PAL.brown, flip); // shoe
    fr(ctx, box, 0.52, 0.80, 0.24, 0.14, PAL.brown, flip);
  } else {
    // Arms at sides.
    fr(ctx, box, 0.12, 0.34, 0.11, 0.20, PAL.red, flip);
    fr(ctx, box, 0.12, 0.52, 0.11, 0.07, PAL.skin, flip);
    fr(ctx, box, 0.77, 0.34, 0.11, 0.20, PAL.red, flip);
    fr(ctx, box, 0.77, 0.52, 0.11, 0.07, PAL.skin, flip);

    // Walking legs animate; standing legs neutral.
    const stride = walkFrame === 1 ? 0.06 : walkFrame === 2 ? -0.06 : 0;
    fr(ctx, box, 0.28 - stride, 0.66, 0.18, 0.18, PAL.blue, flip); // leg L
    fr(ctx, box, 0.54 + stride, 0.66, 0.18, 0.18, PAL.blue, flip); // leg R
    fr(ctx, box, 0.22 - stride, 0.84, 0.24, 0.14, PAL.brown, flip); // shoe L
    fr(ctx, box, 0.54 + stride, 0.84, 0.24, 0.14, PAL.brown, flip); // shoe R
  }

  ctx.globalAlpha = 1;
}

// --------------------------------------------------------------------------
// Goomba
// --------------------------------------------------------------------------
export function drawGoomba(ctx, box, opts = {}) {
  const { walkFrame = 0, squashed = false } = opts;
  if (squashed) {
    fr(ctx, box, 0.05, 0.7, 0.9, 0.3, "#8b5a2b");
    fr(ctx, box, 0.1, 0.7, 0.8, 0.08, "#6b3e1d");
    return;
  }
  // Body (mushroom cap)
  fr(ctx, box, 0.12, 0.10, 0.76, 0.45, "#9c5a2b");
  fr(ctx, box, 0.05, 0.25, 0.9, 0.35, "#9c5a2b");
  fr(ctx, box, 0.05, 0.20, 0.9, 0.06, "#7a431c"); // cap shade
  // Face area
  fr(ctx, box, 0.2, 0.45, 0.6, 0.25, "#d9a066");
  // Eyes
  const ex = walkFrame ? 0.02 : 0;
  fr(ctx, box, 0.26 + ex, 0.34, 0.12, 0.16, PAL.white);
  fr(ctx, box, 0.62 - ex, 0.34, 0.12, 0.16, PAL.white);
  fr(ctx, box, 0.32 + ex, 0.38, 0.05, 0.1, PAL.black);
  fr(ctx, box, 0.63 - ex, 0.38, 0.05, 0.1, PAL.black);
  // Angry brows
  fr(ctx, box, 0.24, 0.30, 0.18, 0.05, PAL.black);
  fr(ctx, box, 0.58, 0.30, 0.18, 0.05, PAL.black);
  // Feet (alternate)
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
    // Green shell.
    fr(ctx, box, 0.1, 0.35, 0.8, 0.5, "#3aa14b");
    fr(ctx, box, 0.15, 0.3, 0.7, 0.12, "#2c7a39");
    fr(ctx, box, 0.2, 0.45, 0.6, 0.3, "#8fe07a"); // shell highlight
    // Hexagon-ish lines
    fr(ctx, box, 0.48, 0.35, 0.04, 0.5, "#2c7a39");
    fr(ctx, box, 0.2, 0.58, 0.6, 0.04, "#2c7a39");
    if (spinning) {
      const t = Math.floor(performance.now() / 60) % 2;
      fr(ctx, box, t ? 0.1 : 0.8, 0.5, 0.1, 0.2, PAL.white);
    }
    return;
  }

  // Shell on back.
  fr(ctx, box, 0.18, 0.28, 0.64, 0.5, "#3aa14b", flip);
  fr(ctx, box, 0.24, 0.34, 0.5, 0.32, "#8fe07a", flip);
  // Head
  fr(ctx, box, 0.62, 0.12, 0.28, 0.26, "#f5d000", flip); // yellow head
  fr(ctx, box, 0.80, 0.20, 0.07, 0.07, PAL.black, flip); // eye
  fr(ctx, box, 0.6, 0.30, 0.30, 0.06, "#d9a066", flip); // beak shade
  // Feet
  if (walkFrame) {
    fr(ctx, box, 0.2, 0.82, 0.22, 0.18, "#f5d000", flip);
    fr(ctx, box, 0.55, 0.82, 0.22, 0.18, "#f5d000", flip);
  } else {
    fr(ctx, box, 0.28, 0.82, 0.22, 0.18, "#f5d000", flip);
    fr(ctx, box, 0.62, 0.82, 0.22, 0.18, "#f5d000", flip);
  }
}

// --------------------------------------------------------------------------
// Power-ups
// --------------------------------------------------------------------------
export function drawMushroom(ctx, box, opts = {}) {
  const oneUp = opts.oneUp;
  const capColor = oneUp ? "#3aa14b" : "#e52521";
  // Stem
  fr(ctx, box, 0.28, 0.5, 0.44, 0.5, "#ffe9c7");
  fr(ctx, box, 0.34, 0.62, 0.1, 0.18, "#5c3a1e"); // eye
  fr(ctx, box, 0.56, 0.62, 0.1, 0.18, "#5c3a1e"); // eye
  // Cap
  fr(ctx, box, 0.1, 0.12, 0.8, 0.42, capColor);
  fr(ctx, box, 0.05, 0.3, 0.9, 0.22, capColor);
  // Spots
  fr(ctx, box, 0.18, 0.2, 0.18, 0.18, PAL.white);
  fr(ctx, box, 0.62, 0.2, 0.18, 0.18, PAL.white);
  fr(ctx, box, 0.42, 0.34, 0.16, 0.14, PAL.white);
}

export function drawCoin(ctx, box, t = 0) {
  // Spinning effect via horizontal squash.
  const phase = (Math.sin(t * 6) + 1) / 2; // 0..1
  const ww = 0.2 + 0.6 * phase;
  const cx = 0.5 - ww / 2;
  fr(ctx, box, cx, 0.05, ww, 0.9, "#f5c518");
  fr(ctx, box, cx + ww * 0.25, 0.2, ww * 0.5, 0.6, "#ffe87a");
  if (phase > 0.4) {
    fr(ctx, box, 0.46, 0.3, 0.08, 0.4, "#b8860b");
  }
}

// Floating score popup ("100", "1UP", etc.)
export function drawPopup(ctx, x, y, text, color = "#fff") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.font = "bold 16px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}
