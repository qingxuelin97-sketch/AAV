// Game entities: the player, enemies, items and particles. Physics is in
// pixels/second and uses simple axis-separated AABB-vs-tile collision.

import {
  TILE,
  GRAVITY,
  MAX_FALL,
  WALK_ACCEL,
  RUN_ACCEL,
  WALK_MAX,
  RUN_MAX,
  FRICTION,
  AIR_FRICTION,
  JUMP_VELOCITY,
  JUMP_CUTOFF,
  COYOTE_TIME,
  JUMP_BUFFER,
  ENEMY_SPEED,
  STOMP_BOUNCE,
} from "./constants.js";
import * as Sprites from "./sprites.js";

// Bodies occupy the half-open box [x, x+w) x [y, y+h). EPS keeps a flush edge
// from registering as an overlap while still catching sub-pixel penetration.
const EPS = 0.001;

// Resolve horizontal movement against solid tiles. Returns true if a wall hit.
function collideX(body, world) {
  let hit = false;
  const top = Math.floor(body.y / TILE);
  const bottom = Math.floor((body.y + body.h - EPS) / TILE);
  if (body.vx > 0) {
    const col = Math.floor((body.x + body.w - EPS) / TILE);
    for (let r = top; r <= bottom; r++) {
      if (world.isSolid(col, r)) {
        body.x = col * TILE - body.w;
        body.vx = 0;
        hit = true;
        break;
      }
    }
  } else if (body.vx < 0) {
    const col = Math.floor(body.x / TILE);
    for (let r = top; r <= bottom; r++) {
      if (world.isSolid(col, r)) {
        body.x = (col + 1) * TILE;
        body.vx = 0;
        hit = true;
        break;
      }
    }
  }
  return hit;
}

// Resolve vertical movement. Sets body.onGround; returns {ground, ceiling}.
function collideY(body, world) {
  let ceiling = false;
  const left = Math.floor(body.x / TILE);
  const right = Math.floor((body.x + body.w - EPS) / TILE);

  if (body.vy > 0) {
    const row = Math.floor((body.y + body.h - EPS) / TILE);
    for (let c = left; c <= right; c++) {
      if (world.isSolid(c, row)) {
        body.y = row * TILE - body.h; // rest flush on the tile top
        body.vy = 0;
        break;
      }
    }
  } else if (body.vy < 0) {
    const row = Math.floor(body.y / TILE);
    for (let c = left; c <= right; c++) {
      if (world.isSolid(c, row)) {
        body.y = (row + 1) * TILE;
        body.vy = 0;
        ceiling = true;
        body._bumpRow = row;
        break;
      }
    }
  }

  // Ground is detected by probing the tile directly beneath the feet, so a body
  // resting flush on a surface stays grounded without jitter.
  let ground = false;
  const footRow = Math.floor((body.y + body.h) / TILE);
  for (let c = left; c <= right; c++) {
    if (world.isSolid(c, footRow)) {
      ground = true;
      break;
    }
  }

  body.onGround = ground;
  return { ground, ceiling };
}

class Body {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  intersects(o) {
    return (
      this.x < o.x + o.w &&
      this.x + this.w > o.x &&
      this.y < o.y + o.h &&
      this.y + this.h > o.y
    );
  }
}

// --------------------------------------------------------------------------
// Player
// --------------------------------------------------------------------------
export class Player extends Body {
  constructor(x, y) {
    super(x, y, 22, 28);
    this.power = "small"; // small | big
    this.facing = 1;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.invincible = 0; // i-frames after taking damage
    this.starTime = 0;
    this.alive = true;
    this.enteringFlag = false;
    this.controllable = true;
  }

  setPower(p) {
    const wasSmall = this.power === "small";
    this.power = p;
    if (p === "big" && wasSmall) {
      // Grow upward, keep feet planted.
      this.y -= 28;
      this.w = 26;
      this.h = 56;
    } else if (p === "small") {
      this.y += this.h - 28;
      this.w = 22;
      this.h = 28;
    }
  }

  damage(game) {
    if (this.invincible > 0 || this.starTime > 0) return;
    if (this.power === "big") {
      this.setPower("small");
      this.invincible = 1.6;
      game.audio.pipe();
    } else {
      game.killPlayer();
    }
  }

  update(dt, input, world, game) {
    if (!this.alive) return;

    if (this.invincible > 0) this.invincible -= dt;
    if (this.starTime > 0) this.starTime -= dt;

    if (this.controllable) {
      const running = input.state.run;
      const accel = running ? RUN_ACCEL : WALK_ACCEL;
      const maxSpeed = running ? RUN_MAX : WALK_MAX;

      let dir = 0;
      if (input.state.left) dir -= 1;
      if (input.state.right) dir += 1;

      if (dir !== 0) {
        this.vx += dir * accel * dt;
        this.facing = dir;
        this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      } else {
        // Friction.
        const f = (this.onGround ? FRICTION : AIR_FRICTION) * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
      }

      // Jump with coyote time + input buffering.
      if (input.consume("jump")) this.jumpBuffer = JUMP_BUFFER;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.onGround) this.coyote = COYOTE_TIME;
      else if (this.coyote > 0) this.coyote -= dt;

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = JUMP_VELOCITY;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpHeld = true;
        game.audio.jump();
      }

      // Variable jump height: cut velocity when the jump key is released.
      if (this.jumpHeld && !input.state.jump && this.vy < 0) {
        this.vy *= JUMP_CUTOFF;
        this.jumpHeld = false;
      }
      if (!input.state.jump) this.jumpHeld = false;
    } else {
      this.vx = this.autoVx || 0;
    }

    // Gravity.
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);

    // Move + collide.
    this.x += this.vx * dt;
    collideX(this, world);
    this.y += this.vy * dt;
    const { ceiling } = collideY(this, world);

    if (ceiling && this._bumpRow != null) {
      world.bumpBlock(Math.floor(this.cx / TILE), this._bumpRow, this, game);
      this._bumpRow = null;
    }

    // Keep inside left edge.
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }

    // Walk animation.
    if (this.onGround && Math.abs(this.vx) > 12) {
      this.walkTimer += Math.abs(this.vx) * dt;
      const period = 18;
      this.walkFrame = Math.floor(this.walkTimer / period) % 2 === 0 ? 1 : 2;
    } else {
      this.walkFrame = 0;
    }

    // Fell into a pit.
    if (this.y > world.pixelHeight + 80) {
      game.killPlayer(true);
    }
  }

  draw(ctx) {
    Sprites.drawMario(
      ctx,
      { x: this.x - 3, y: this.y, w: this.w + 6, h: this.h },
      {
        facing: this.facing,
        walkFrame: this.walkFrame,
        jumping: !this.onGround,
        big: this.power === "big",
        invincible: this.invincible > 0 || this.starTime > 0,
      }
    );
  }
}

// --------------------------------------------------------------------------
// Goomba
// --------------------------------------------------------------------------
export class Goomba extends Body {
  constructor(col, row) {
    super(col * TILE + 4, row * TILE + 4, 24, 28);
    this.vx = -ENEMY_SPEED;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.squashTime = 0;
    this.state = "walk"; // walk | squashed | flipped
  }

  squash(game) {
    this.state = "squashed";
    this.squashTime = 0.4;
    this.vx = 0;
    game.audio.stomp();
  }

  // Knocked away by a shell or star.
  flip(dir, game) {
    this.state = "flipped";
    this.vy = -300;
    this.vx = 60 * dir;
    game.audio.stomp();
  }

  update(dt, world) {
    if (this.state === "squashed") {
      this.squashTime -= dt;
      if (this.squashTime <= 0) this.dead = true;
      return;
    }
    if (this.state === "flipped") {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > world.pixelHeight + 100) this.dead = true;
      return;
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.x += this.vx * dt;
    if (collideX(this, world)) this.vx = -this.vx;
    this.y += this.vy * dt;
    collideY(this, world);

    // Turn around at ledges so they stay on platforms.
    if (this.onGround) {
      const aheadCol = Math.floor((this.vx > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
      const footRow = Math.floor((this.y + this.h + 2) / TILE);
      if (!world.isSolid(aheadCol, footRow)) this.vx = -this.vx;
    }

    if (this.y > world.pixelHeight + 100) this.dead = true;

    this.walkTimer += dt;
    if (this.walkTimer > 0.18) {
      this.walkTimer = 0;
      this.walkFrame ^= 1;
    }
  }

  draw(ctx) {
    Sprites.drawGoomba(
      ctx,
      { x: this.x, y: this.y, w: this.w, h: this.h },
      { walkFrame: this.walkFrame, squashed: this.state === "squashed" }
    );
  }
}

// --------------------------------------------------------------------------
// Koopa Troopa
// --------------------------------------------------------------------------
export class Koopa extends Body {
  constructor(col, row) {
    super(col * TILE + 4, row * TILE - 8, 26, 40);
    this.vx = -ENEMY_SPEED;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.state = "walk"; // walk | shell | spin
    this.facing = -1;
    this.shellTimer = 0;
  }

  toShell(game) {
    this.state = "shell";
    this.shellTimer = 6; // revives if left alone
    this.vx = 0;
    this.h = 26;
    this.y += 14;
    game.audio.stomp();
  }

  kick(dir, game) {
    this.state = "spin";
    this.vx = 320 * dir;
    game.audio.bump();
  }

  stopShell() {
    this.state = "shell";
    this.shellTimer = 6;
    this.vx = 0;
  }

  flip(dir, game) {
    this.state = "flipped";
    this.vy = -300;
    this.vx = 60 * dir;
    game.audio.stomp();
  }

  update(dt, world) {
    if (this.state === "flipped") {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > world.pixelHeight + 100) this.dead = true;
      return;
    }

    if (this.state === "shell") {
      this.shellTimer -= dt;
      if (this.shellTimer <= 0) {
        // Revive to walking koopa.
        this.state = "walk";
        this.h = 40;
        this.y -= 14;
        this.vx = -ENEMY_SPEED;
      }
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.x += this.vx * dt;
    if (collideX(this, world)) this.vx = -this.vx;
    this.y += this.vy * dt;
    collideY(this, world);

    if (this.state === "walk" && this.onGround) {
      const aheadCol = Math.floor((this.vx > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
      const footRow = Math.floor((this.y + this.h + 2) / TILE);
      if (!world.isSolid(aheadCol, footRow)) this.vx = -this.vx;
    }

    if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;

    if (this.y > world.pixelHeight + 100) this.dead = true;

    this.walkTimer += dt;
    if (this.walkTimer > 0.18) {
      this.walkTimer = 0;
      this.walkFrame ^= 1;
    }
  }

  draw(ctx) {
    Sprites.drawKoopa(
      ctx,
      { x: this.x, y: this.y, w: this.w, h: this.h },
      {
        walkFrame: this.walkFrame,
        facing: this.facing,
        shell: this.state === "shell" || this.state === "spin",
        spinning: this.state === "spin",
      }
    );
  }
}

// --------------------------------------------------------------------------
// Mushroom / 1-Up
// --------------------------------------------------------------------------
export class Mushroom extends Body {
  constructor(x, y, oneUp = false) {
    super(x, y, 26, 26);
    this.oneUp = oneUp;
    this.vx = 0;
    this.emerging = TILE; // pixels left to rise out of the block
    this.spawned = false;
  }

  update(dt, world) {
    if (this.emerging > 0) {
      const rise = 40 * dt;
      this.y -= rise;
      this.emerging -= rise;
      if (this.emerging <= 0) {
        this.vx = ENEMY_SPEED;
        this.spawned = true;
      }
      return;
    }
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.x += this.vx * dt;
    if (collideX(this, world)) this.vx = -this.vx;
    this.y += this.vy * dt;
    collideY(this, world);
    if (this.y > world.pixelHeight + 100) this.dead = true;
  }

  draw(ctx) {
    Sprites.drawMushroom(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, { oneUp: this.oneUp });
  }
}

// --------------------------------------------------------------------------
// Particles (brick debris, sparkles) + floating score text
// --------------------------------------------------------------------------
export class Particle extends Body {
  constructor(x, y, vx, vy, color, size = 6, life = 0.9) {
    super(x, y, size, size);
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
  }
  update(dt) {
    this.vy += GRAVITY * 0.7 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor(x, y, text, color = "#fff") {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.9;
    this.dead = false;
  }
  update(dt) {
    this.y -= 40 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / 0.9);
    Sprites.drawPopup(ctx, this.x, this.y, this.text, this.color);
    ctx.globalAlpha = 1;
  }
}
