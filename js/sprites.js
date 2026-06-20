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

// A soft elliptical ground shadow for depth.
export function drawShadow(ctx, cx, footY, w) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.translate(cx, footY - 2);
  ctx.scale(1, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(8, w * 0.55), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
    gliding = false,
    spinning = false,
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
  } else if (power === "tail") {
    cap = "#d98a3a"; // raccoon tan
    overall = PAL.white;
    shirt = "#d98a3a";
  } else if (power === "boomerang") {
    cap = "#e8e8e8";
    overall = "#2a4fd6";
    shirt = "#e8e8e8";
  }
  const flowerForm = power === "fire" || power === "ice";

  // Raccoon tail behind Mario (leaf form): swishes while gliding/spinning.
  if (power === "tail") {
    const swish = gliding || spinning ? 0.06 : 0;
    fr(ctx, box, 0.02, 0.5 - swish, 0.16, 0.22, "#d98a3a", flip); // tail base
    fr(ctx, box, -0.02, 0.46 - swish, 0.1, 0.12, "#8a5520", flip); // tail tip
    fr(ctx, box, 0.05, 0.54 - swish, 0.1, 0.05, "#fff3e0", flip); // tail stripe
    // raccoon ears on the cap
    fr(ctx, box, 0.24, -0.02, 0.1, 0.07, "#8a5520", flip);
    fr(ctx, box, 0.62, -0.02, 0.1, 0.07, "#8a5520", flip);
  }
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
  if (opts.blinking) {
    fr(ctx, box, 0.54, 0.205, 0.08, 0.02, PAL.brown, flip); // closed eye
  } else {
    fr(ctx, box, 0.55, 0.16, 0.06, 0.07, PAL.black, flip); // eye
  }
  fr(ctx, box, 0.44, 0.26, 0.30, 0.05, PAL.brown, flip); // mustache

  // Torso (shirt)
  fr(ctx, box, 0.22, 0.31, 0.56, 0.22, shirt, flip);
  // Overalls
  fr(ctx, box, 0.28, 0.40, 0.44, 0.30, overall, flip);
  fr(ctx, box, 0.30, 0.31, 0.08, 0.12, overall, flip); // strap L
  fr(ctx, box, 0.60, 0.31, 0.08, 0.12, overall, flip); // strap R
  fr(ctx, box, 0.33, 0.44, 0.06, 0.06, PAL.yellow, flip); // button
  fr(ctx, box, 0.60, 0.44, 0.06, 0.06, PAL.yellow, flip); // button

  const airPose = jumping || opts.swimming;
  if (skid && !airPose) {
    // Skid pose: front arm out, leaning back.
    fr(ctx, box, 0.74, 0.30, 0.16, 0.12, shirt, flip);
    fr(ctx, box, 0.84, 0.30, 0.10, 0.08, PAL.skin, flip);
    fr(ctx, box, 0.30, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.52, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.24, 0.84, 0.26, 0.14, PAL.brown, flip);
    fr(ctx, box, 0.52, 0.84, 0.26, 0.14, PAL.brown, flip);
  } else if (opts.swimming) {
    // Swim pose: both arms forward-ish, legs kicking (frog kick on stroke).
    const kick = opts.stroke ? 0.06 : 0;
    fr(ctx, box, 0.74, 0.30, 0.16, 0.10, shirt, flip); // front arm out
    fr(ctx, box, 0.86, 0.30, 0.10, 0.08, PAL.skin, flip);
    fr(ctx, box, 0.08, 0.34, 0.12, 0.10, shirt, flip); // back arm
    fr(ctx, box, 0.08, 0.42, 0.12, 0.07, PAL.skin, flip);
    fr(ctx, box, 0.28, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.54, 0.66, 0.18, 0.18, overall, flip);
    fr(ctx, box, 0.20 - kick, 0.82, 0.26, 0.13, PAL.brown, flip); // kicking feet
    fr(ctx, box, 0.54 + kick, 0.82, 0.26, 0.13, PAL.brown, flip);
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
  // Mushroom-shaped cap with top-down shading.
  fr(ctx, box, 0.08, 0.08, 0.84, 0.5, "#9c5a2b");
  fr(ctx, box, 0.03, 0.24, 0.94, 0.34, "#9c5a2b");
  fr(ctx, box, 0.08, 0.08, 0.84, 0.09, "#b46c38"); // top highlight
  fr(ctx, box, 0.16, 0.13, 0.34, 0.05, "#c98049"); // gloss
  fr(ctx, box, 0.03, 0.5, 0.94, 0.1, "#7a431c"); // bottom shade
  // Face
  fr(ctx, box, 0.2, 0.46, 0.6, 0.24, "#e3ac6c");
  // Angry brows
  fr(ctx, box, 0.22, 0.3, 0.2, 0.06, PAL.black);
  fr(ctx, box, 0.58, 0.3, 0.2, 0.06, PAL.black);
  // Eyes (+ a little shine)
  const ex = walkFrame ? 0.02 : 0;
  fr(ctx, box, 0.27 + ex, 0.34, 0.13, 0.17, PAL.white);
  fr(ctx, box, 0.6 - ex, 0.34, 0.13, 0.17, PAL.white);
  fr(ctx, box, 0.33 + ex, 0.39, 0.06, 0.1, PAL.black);
  fr(ctx, box, 0.63 - ex, 0.39, 0.06, 0.1, PAL.black);
  fr(ctx, box, 0.34 + ex, 0.4, 0.02, 0.03, PAL.white);
  fr(ctx, box, 0.64 - ex, 0.4, 0.02, 0.03, PAL.white);
  // Feet
  if (walkFrame) {
    fr(ctx, box, 0.1, 0.85, 0.3, 0.15, "#3a2410");
    fr(ctx, box, 0.6, 0.85, 0.3, 0.15, "#3a2410");
  } else {
    fr(ctx, box, 0.18, 0.85, 0.3, 0.15, "#3a2410");
    fr(ctx, box, 0.52, 0.85, 0.3, 0.15, "#3a2410");
  }
}

// --------------------------------------------------------------------------
// Spiny — a spiked red enemy you can't stomp.
// --------------------------------------------------------------------------
export function drawSpiny(ctx, box, opts = {}) {
  const { walkFrame = 0, facing = 1 } = opts;
  const flip = facing < 0;
  // Spiky orange shell with darker rim.
  fr(ctx, box, 0.12, 0.34, 0.76, 0.44, "#d9531e", flip);
  fr(ctx, box, 0.18, 0.4, 0.64, 0.3, "#f07a2e", flip); // shell highlight
  fr(ctx, box, 0.12, 0.68, 0.76, 0.1, "#a83a12", flip); // bottom shade
  // White spikes ringing the shell.
  const spike = (fx, fy, fw, fh) => {
    ctx.fillStyle = "#fff3e0";
    ctx.beginPath();
    const { x, y, w, h } = box;
    const rx = flip ? 1 - fx - fw : fx;
    ctx.moveTo(x + rx * w, y + (fy + fh) * h);
    ctx.lineTo(x + (rx + fw / 2) * w, y + fy * h);
    ctx.lineTo(x + (rx + fw) * w, y + (fy + fh) * h);
    ctx.closePath();
    ctx.fill();
  };
  for (const fx of [0.1, 0.32, 0.54, 0.76]) spike(fx, 0.12, 0.16, 0.22);
  spike(0.02, 0.42, 0.14, 0.2);
  spike(0.84, 0.42, 0.14, 0.2);
  // Face peeking out the front.
  fr(ctx, box, 0.52, 0.48, 0.3, 0.22, "#ffd9a0", flip);
  fr(ctx, box, 0.62, 0.52, 0.08, 0.09, PAL.white, flip);
  fr(ctx, box, 0.64, 0.54, 0.05, 0.06, PAL.black, flip);
  fr(ctx, box, 0.56, 0.5, 0.12, 0.03, PAL.black, flip); // angry brow
  // Feet
  if (walkFrame) {
    fr(ctx, box, 0.18, 0.86, 0.24, 0.14, "#a83a12", flip);
    fr(ctx, box, 0.56, 0.86, 0.24, 0.14, "#a83a12", flip);
  } else {
    fr(ctx, box, 0.24, 0.86, 0.24, 0.14, "#a83a12", flip);
    fr(ctx, box, 0.5, 0.86, 0.24, 0.14, "#a83a12", flip);
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

  // Shell with layered shading + belly
  fr(ctx, box, 0.16, 0.26, 0.66, 0.52, "#2c7a39", flip);
  fr(ctx, box, 0.2, 0.3, 0.56, 0.42, "#3aa14b", flip);
  fr(ctx, box, 0.26, 0.36, 0.42, 0.26, "#8fe07a", flip); // shell highlight
  fr(ctx, box, 0.16, 0.7, 0.66, 0.09, "#1f5e29", flip); // bottom shade
  fr(ctx, box, 0.5, 0.4, 0.2, 0.34, "#f0d68a", flip); // belly
  // Head
  fr(ctx, box, 0.6, 0.1, 0.3, 0.28, "#f5d000", flip);
  fr(ctx, box, 0.6, 0.1, 0.3, 0.07, "#ffe24a", flip); // top light
  fr(ctx, box, 0.82, 0.19, 0.08, 0.08, PAL.white, flip); // eye white
  fr(ctx, box, 0.84, 0.2, 0.05, 0.06, PAL.black, flip);
  fr(ctx, box, 0.6, 0.3, 0.3, 0.06, "#d9a066", flip); // beak
  if (walkFrame) {
    fr(ctx, box, 0.2, 0.82, 0.22, 0.18, "#e0b800", flip);
    fr(ctx, box, 0.55, 0.82, 0.22, 0.18, "#e0b800", flip);
  } else {
    fr(ctx, box, 0.28, 0.82, 0.22, 0.18, "#e0b800", flip);
    fr(ctx, box, 0.62, 0.82, 0.22, 0.18, "#e0b800", flip);
  }
}

// --------------------------------------------------------------------------
// Paratroopa — a Koopa with flapping white wings (drawn red-shelled so it
// reads as distinct from a ground Koopa).
// --------------------------------------------------------------------------
export function drawParatroopa(ctx, box, opts = {}) {
  const { walkFrame = 0, facing = 1 } = opts;
  const flip = facing < 0;
  // Flapping wing behind the shell.
  const up = walkFrame ? 0.0 : 0.12;
  fr(ctx, box, 0.04, 0.28 - up, 0.2, 0.1, PAL.white, flip);
  fr(ctx, box, 0.0, 0.34 - up, 0.16, 0.12, PAL.white, flip);
  fr(ctx, box, 0.06, 0.28 - up, 0.16, 0.04, "#cfe2ff", flip);
  // Red shell body
  fr(ctx, box, 0.18, 0.26, 0.64, 0.52, "#a8211c", flip);
  fr(ctx, box, 0.22, 0.3, 0.54, 0.42, "#e23a2f", flip);
  fr(ctx, box, 0.28, 0.36, 0.4, 0.26, "#ff8a82", flip); // highlight
  fr(ctx, box, 0.18, 0.7, 0.64, 0.09, "#7a1410", flip); // bottom shade
  fr(ctx, box, 0.5, 0.4, 0.2, 0.34, "#f0d68a", flip); // belly
  // Head
  fr(ctx, box, 0.6, 0.1, 0.3, 0.28, "#f5d000", flip);
  fr(ctx, box, 0.6, 0.1, 0.3, 0.07, "#ffe24a", flip);
  fr(ctx, box, 0.82, 0.19, 0.08, 0.08, PAL.white, flip);
  fr(ctx, box, 0.84, 0.2, 0.05, 0.06, PAL.black, flip);
  fr(ctx, box, 0.6, 0.3, 0.3, 0.06, "#d9a066", flip); // beak
  // Feet
  fr(ctx, box, 0.28, 0.82, 0.22, 0.16, "#e0b800", flip);
  fr(ctx, box, 0.62, 0.82, 0.22, 0.16, "#e0b800", flip);
}

// --------------------------------------------------------------------------
// Cheep Cheep — a round red fish with a flapping tail fin.
// --------------------------------------------------------------------------
export function drawCheep(ctx, box, opts = {}) {
  const { facing = -1, t = 0 } = opts;
  const { x, y, w, h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (facing > 0) ctx.scale(-1, 1); // default art faces left
  const flap = Math.sin(t * 12) * 0.2;
  // Tail fin
  ctx.fillStyle = "#c8261f";
  ctx.beginPath();
  ctx.moveTo(w * 0.32, 0);
  ctx.lineTo(w * 0.55, -h * (0.34 + flap));
  ctx.lineTo(w * 0.55, h * (0.34 - flap));
  ctx.closePath();
  ctx.fill();
  // Body (scaled circle so we avoid ctx.ellipse for wide stub compatibility)
  const oval = (ox, oy, rx, ry, col) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(rx, ry);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  oval(-w * 0.04, 0, w * 0.4, h * 0.42, "#e23a2f");
  oval(-w * 0.04, h * 0.12, w * 0.3, h * 0.22, "#ff8a82"); // belly highlight
  // Pectoral fin
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, h * 0.05);
  ctx.lineTo(-w * 0.28, h * (0.3 + flap));
  ctx.lineTo(0, h * 0.18);
  ctx.closePath();
  ctx.fill();
  // Lips
  ctx.fillStyle = "#fff";
  ctx.fillRect(-w * 0.46, -h * 0.04, w * 0.1, h * 0.12);
  // Eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-w * 0.24, -h * 0.12, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(-w * 0.26, -h * 0.12, w * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

// Super Leaf — an autumn-brown leaf with veins (grants the raccoon tail).
export function drawSuperLeaf(ctx, box, t = 0) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.sin(t * 4) * 0.12);
  ctx.fillStyle = "#8a5520";
  ctx.fillRect(-1, h * 0.1, 2, h * 0.4); // stem
  // three lobes of the leaf
  ctx.fillStyle = "#e0902f";
  for (const dx of [-w * 0.28, 0, w * 0.28]) {
    ctx.beginPath();
    ctx.moveTo(dx, h * 0.12);
    ctx.lineTo(dx - w * 0.18, -h * 0.18);
    ctx.lineTo(dx, -h * 0.42);
    ctx.lineTo(dx + w * 0.18, -h * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#f6c45a"; // highlight
  ctx.fillRect(-w * 0.04, -h * 0.34, w * 0.08, h * 0.36);
  ctx.strokeStyle = "#8a5520";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.12);
  ctx.lineTo(0, -h * 0.36);
  ctx.stroke();
  ctx.restore();
}

// Boomerang Flower — a flower whose petals are little boomerangs.
export function drawBoomerangFlower(ctx, box, t = 0) {
  fr(ctx, box, 0.44, 0.55, 0.12, 0.45, "#2e9c2e"); // stem
  fr(ctx, box, 0.22, 0.6, 0.2, 0.1, "#2e9c2e");
  fr(ctx, box, 0.58, 0.6, 0.2, 0.1, "#2e9c2e");
  const { x, y, w, h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h * 0.3);
  ctx.rotate(t * 2);
  ctx.fillStyle = "#e8e8ec";
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.12);
    ctx.lineTo(w * 0.22, -h * 0.18);
    ctx.lineTo(w * 0.16, -h * 0.34);
    ctx.lineTo(0, -h * 0.26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#3a5cd0";
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A thrown boomerang — a spinning white "V".
export function drawBoomerang(ctx, box, t = 0) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(t * 22);
  ctx.fillStyle = "#f2f2f5";
  ctx.strokeStyle = "#c23a2a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.1);
  ctx.lineTo(0, -h * 0.5);
  ctx.lineTo(h * 0.15, -h * 0.2);
  ctx.lineTo(w * 0.5, h * 0.35);
  ctx.lineTo(h * 0.1, h * 0.2);
  ctx.lineTo(-h * 0.2, h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
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

// Bowser — a big, detailed spiky boss. Drawn in local coordinates with a
// horizontal flip so he always faces the player.
export function drawBowser(ctx, box, opts = {}) {
  const { facing = -1, walkFrame = 0, hurt = false, dead = false, tint = null, stunned = false, telegraph = false } = opts;
  const { x, y, w, h } = box;

  ctx.save();
  if (hurt && Math.floor(performance.now() / 60) % 2 === 0) ctx.globalAlpha = 0.55;
  // Local origin at the box; flip so the head faces left toward the player.
  if (facing > 0) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  if (dead) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-w / 2, -h / 2);
  }

  const P = (fx, fy, fw, fh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(fx * w), Math.round(fy * h), Math.ceil(fw * w), Math.ceil(fh * h));
  };
  const SPIKE = (fx, fy, fw, fh, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(fx * w, (fy + fh) * h);
    ctx.lineTo((fx + fw / 2) * w, fy * h);
    ctx.lineTo((fx + fw) * w, (fy + fh) * h);
    ctx.closePath();
    ctx.fill();
  };

  const SHELL = "#1f7a34", SHELL2 = "#3fb24c", SHELL3 = "#9bee82";
  const SKIN = "#e7c24a", SKIN2 = "#c79a2e", BELLY = "#f7e8b4";
  const MANE = "#b5341f", HORN = "#f4efd6", BONE = "#fff7df";

  // Tail
  SPIKE(0.74, 0.6, 0.22, 0.12, SHELL);
  P(0.78, 0.62, 0.18, 0.1, SHELL2);

  // Back legs + clawed feet
  P(0.5, 0.78, 0.2, 0.2, SKIN);
  P(0.2, 0.8, 0.2, 0.18, SKIN);
  P(0.18 + (walkFrame ? 0.02 : 0), 0.94, 0.26, 0.06, SKIN2);
  P(0.5, 0.94, 0.26, 0.06, SKIN2);
  ctx.fillStyle = BONE;
  for (const fx of [0.2, 0.27, 0.34, 0.52, 0.59, 0.66]) SPIKE(fx, 0.9, 0.05, 0.06, BONE);

  // Shell — layered dome with spikes
  P(0.34, 0.34, 0.6, 0.5, SHELL);
  P(0.4, 0.4, 0.46, 0.36, SHELL2);
  P(0.46, 0.46, 0.32, 0.24, SHELL3);
  // shell rim studs
  ctx.fillStyle = "#155a25";
  for (let i = 0; i < 4; i++) P(0.4 + i * 0.13, 0.78, 0.05, 0.05, "#155a25");
  // big back spikes
  for (let i = 0; i < 4; i++) SPIKE(0.36 + i * 0.15, 0.22, 0.13, 0.16, HORN);

  // Belly / chest
  P(0.18, 0.46, 0.34, 0.38, SKIN);
  P(0.22, 0.5, 0.24, 0.32, BELLY);
  ctx.fillStyle = SKIN2;
  for (let i = 0; i < 3; i++) P(0.23, 0.56 + i * 0.08, 0.22, 0.02, SKIN2); // belly ridges

  // Arm with claws
  P(0.2, 0.5, 0.16, 0.22, SKIN);
  ctx.fillStyle = BONE;
  for (const fy of [0.66, 0.71]) SPIKE(0.16, fy, 0.06, 0.05, BONE);

  // Spiked black cuffs (wrists/ankles)
  P(0.2, 0.64, 0.16, 0.05, "#161616");
  SPIKE(0.2, 0.6, 0.06, 0.05, BONE);
  SPIKE(0.3, 0.6, 0.06, 0.05, BONE);

  // Head
  P(0.05, 0.22, 0.34, 0.3, SKIN);
  P(0.0, 0.34, 0.16, 0.16, SKIN); // snout
  // red mane around the head
  for (const [fx, fy] of [[0.06, 0.12], [0.16, 0.08], [0.27, 0.1], [0.36, 0.16]])
    SPIKE(fx, fy, 0.13, 0.14, MANE);
  P(0.3, 0.18, 0.14, 0.2, MANE);
  // horns
  SPIKE(0.1, 0.08, 0.1, 0.14, HORN);
  SPIKE(0.26, 0.06, 0.1, 0.14, HORN);
  // eyebrow + eye
  ctx.fillStyle = "#7a2b1a";
  P(0.16, 0.26, 0.16, 0.04, "#7a2b1a");
  P(0.2, 0.3, 0.1, 0.08, BONE);
  P(0.22, 0.31, 0.05, 0.06, PAL.black);
  // snout: nostrils + fanged mouth
  P(0.02, 0.37, 0.04, 0.03, PAL.black);
  P(0.0, 0.45, 0.22, 0.05, "#5a3a10"); // mouth line
  ctx.fillStyle = BONE;
  for (const fx of [0.03, 0.09, 0.15]) SPIKE(fx, 0.45, 0.05, 0.06, BONE); // lower fangs
  if (telegraph) {
    // glowing maw when about to attack
    P(0.0, 0.44, 0.16, 0.04, "#ff8a2a");
  }

  if (stunned) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#bfe9ff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (tint && !dead) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

// Kraken / Boss Bass — the underwater boss: a big hovering squid with a
// glowing beak (lights up when telegraphing) and waving tentacles.
export function drawKraken(ctx, box, opts = {}) {
  const { facing = -1, hurt = false, dead = false, tint = null, stunned = false, telegraph = false } = opts;
  const { x, y, w, h } = box;
  ctx.save();
  if (hurt && Math.floor(performance.now() / 60) % 2 === 0) ctx.globalAlpha = 0.55;
  if (facing > 0) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  if (dead) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-w / 2, -h / 2);
  }
  const t = performance.now() / 1000;
  const BODY = "#2a86a0", BODY2 = "#3fb0c8", BODY3 = "#8fe6f2", DARK = "#1c5e72";

  // Waving tentacles (drawn first, behind the body).
  ctx.strokeStyle = BODY;
  ctx.lineWidth = Math.max(3, w * 0.06);
  for (let i = 0; i < 6; i++) {
    const tx = w * (0.2 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.62);
    for (let s = 1; s <= 3; s++) {
      const yy = h * (0.62 + s * 0.12);
      const xx = tx + Math.sin(t * 4 + i + s) * w * 0.05;
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  // suction dots on a couple of front tentacles
  ctx.fillStyle = BODY3;
  for (let s = 0; s < 3; s++) ctx.fillRect(w * 0.2, h * (0.66 + s * 0.12), 3, 3);

  // Mantle / head (a rounded dome with a pointed top).
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.04);
  ctx.quadraticCurveTo(w * 0.98, h * 0.18, w * 0.86, h * 0.6);
  ctx.quadraticCurveTo(w * 0.5, h * 0.74, w * 0.14, h * 0.6);
  ctx.quadraticCurveTo(w * 0.02, h * 0.18, w * 0.5, h * 0.04);
  ctx.fill();
  // shading + highlight
  ctx.fillStyle = BODY2;
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(w * 0.5, h * 0.34, w * 0.3, h * 0.22, 0, 0, Math.PI * 2) : ctx.rect(w * 0.2, h * 0.14, w * 0.6, h * 0.4);
  ctx.fill();
  ctx.fillStyle = BODY3;
  ctx.fillRect(w * 0.36, h * 0.12, w * 0.12, h * 0.06);

  // Big eyes.
  for (const ex of [0.34, 0.62]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(w * ex, h * 0.38, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#10303a";
    ctx.beginPath();
    ctx.arc(w * ex + (facing > 0 ? 2 : -2), h * 0.4, w * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  // angry brow
  ctx.fillStyle = DARK;
  ctx.fillRect(w * 0.26, h * 0.3, w * 0.2, h * 0.03);
  ctx.fillRect(w * 0.56, h * 0.3, w * 0.2, h * 0.03);

  // Beak / mouth — glows when about to attack.
  ctx.fillStyle = telegraph ? "#ffd23f" : "#f4b942";
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.56);
  ctx.lineTo(w * 0.58, h * 0.56);
  ctx.lineTo(w * 0.5, h * 0.66);
  ctx.closePath();
  ctx.fill();
  if (telegraph) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff7c0";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.6, w * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (stunned) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#bfe9ff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (tint && !dead) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

// Hammer King — the mid-game mini-boss: a burly armoured Koopa with a mallet.
export function drawHammerKing(ctx, box, opts = {}) {
  const { facing = -1, walkFrame = 0, hurt = false, dead = false, tint = null, stunned = false, telegraph = false } = opts;
  const { x, y, w, h } = box;
  ctx.save();
  if (hurt && Math.floor(performance.now() / 60) % 2 === 0) ctx.globalAlpha = 0.55;
  if (facing > 0) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  if (dead) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-w / 2, -h / 2);
  }
  const P = (fx, fy, fw, fh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(fx * w), Math.round(fy * h), Math.ceil(fw * w), Math.ceil(fh * h));
  };

  // feet
  P(0.24 + (walkFrame ? 0.03 : 0), 0.88, 0.2, 0.12, "#f0c020");
  P(0.54, 0.88, 0.2, 0.12, "#f0c020");
  // green shell body
  P(0.26, 0.36, 0.5, 0.5, "#2f8f3a");
  P(0.32, 0.42, 0.34, 0.34, "#7fd06a");
  P(0.36, 0.46, 0.05, 0.26, "#1f6a28");
  P(0.52, 0.46, 0.05, 0.26, "#1f6a28");
  // arms
  P(0.18, 0.46, 0.14, 0.22, "#f0c020");
  P(0.66, 0.44, 0.14, 0.22, "#f0c020");
  // head (yellow) with hard hat
  P(0.1, 0.18, 0.3, 0.26, "#f5d23a");
  P(0.32, 0.26, 0.08, 0.06, "#c79a2e"); // beak
  P(0.18, 0.24, 0.06, 0.07, PAL.black); // eye
  P(0.06, 0.12, 0.36, 0.09, "#d8d8d8"); // helmet
  P(0.06, 0.2, 0.36, 0.03, "#9a9a9a");
  P(0.2, 0.06, 0.1, 0.07, "#b0b0b0"); // helmet crest
  // the mallet (held up, ready)
  ctx.save();
  ctx.translate(0.74 * w, 0.36 * h);
  ctx.rotate(telegraph ? -0.5 : -0.15);
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(-2, -2, 4, 0.34 * h); // handle
  ctx.fillStyle = "#9a9aa0";
  ctx.fillRect(-0.12 * w, -0.16 * h, 0.24 * w, 0.16 * h); // head
  ctx.fillStyle = "#73737a";
  ctx.fillRect(-0.12 * w, -0.16 * h, 0.07 * w, 0.16 * h);
  ctx.restore();

  if (stunned) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#bfe9ff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (tint && !dead) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

// A thrown hammer (lobbed boss projectile).
export function drawHammer(ctx, box, t = 0) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(t * 14);
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(-2, -1, 4, h * 0.5); // handle
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(-w * 0.45, -h * 0.45, w * 0.9, h * 0.4); // head
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(-w * 0.45, -h * 0.45, w * 0.18, h * 0.4);
  ctx.restore();
}

// A ground shockwave (boss slam attack).
export function drawShockwave(ctx, box, t = 0) {
  const { x, y, w, h } = box;
  const wob = Math.sin(t * 30) * 2;
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.5, y + wob);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff7a1e";
  ctx.fillRect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.5);
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
