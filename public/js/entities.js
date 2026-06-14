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
  JUMP_VELOCITY_RUN,
  JUMP_CUTOFF,
  COYOTE_TIME,
  JUMP_BUFFER,
  ENEMY_SPEED,
  STOMP_BOUNCE,
  FIREBALL_SPEED,
  FIREBALL_BOUNCE,
  FREEZE_TIME,
  BOSS_HP,
} from "./constants.js";
import * as Sprites from "./sprites.js";

// Bodies occupy the half-open box [x, x+w) x [y, y+h). EPS keeps a flush edge
// from registering as an overlap while still catching sub-pixel penetration.
const EPS = 0.001;

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

function collideY(body, world) {
  let ceiling = false;
  const left = Math.floor(body.x / TILE);
  const right = Math.floor((body.x + body.w - EPS) / TILE);

  if (body.vy > 0) {
    const row = Math.floor((body.y + body.h - EPS) / TILE);
    for (let c = left; c <= right; c++) {
      if (world.isSolid(c, row)) {
        body.y = row * TILE - body.h;
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
    this.power = "small"; // small | big | fire
    this.facing = 1;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.invincible = 0;
    this.starTime = 0;
    this.alive = true;
    this.controllable = true;
    this.skid = false;
    this.fireCooldown = 0;
  }

  get isBig() {
    return this.h > 40;
  }

  setPower(p) {
    const wasBig = this.isBig;
    const willBig = p !== "small";
    if (willBig && !wasBig) {
      this.y -= 28;
      this.w = 26;
      this.h = 56;
    } else if (!willBig && wasBig) {
      this.y += this.h - 28;
      this.w = 22;
      this.h = 28;
    }
    this.power = p;
  }

  giveStar() {
    this.starTime = 10;
  }

  damage(game) {
    if (this.invincible > 0 || this.starTime > 0) return;
    if (this.power !== "small") {
      this.setPower("small");
      this.invincible = 1.7;
      game.audio.powerdown();
    } else {
      game.killPlayer();
    }
  }

  update(dt, input, world, game) {
    if (!this.alive) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.starTime > 0) {
      this.starTime -= dt;
      if (this.starTime <= 0) game.onStarEnd?.();
    }
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    this.skid = false;

    if (this.controllable) {
      const running = input.state.run;
      const accel = running ? RUN_ACCEL : WALK_ACCEL;
      const maxSpeed = running ? RUN_MAX : WALK_MAX;

      let dir = 0;
      if (input.state.left) dir -= 1;
      if (input.state.right) dir += 1;

      if (dir !== 0) {
        // Skidding: pressing opposite to current momentum.
        if (this.onGround && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 40) {
          this.skid = true;
        }
        this.vx += dir * accel * dt;
        this.facing = dir;
        this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      } else {
        const f = (this.onGround ? FRICTION : AIR_FRICTION) * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
      }

      // Throw a fireball (fire Mario only).
      if (this.power === "fire" && this.fireCooldown <= 0 && input.consume("run")) {
        if (game.spawnFireball(this)) this.fireCooldown = 0.28;
      }

      // Jump with coyote time + input buffering + variable height.
      if (input.consume("jump")) this.jumpBuffer = JUMP_BUFFER;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.onGround) this.coyote = COYOTE_TIME;
      else if (this.coyote > 0) this.coyote -= dt;

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = Math.abs(this.vx) > WALK_MAX ? JUMP_VELOCITY_RUN : JUMP_VELOCITY;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpHeld = true;
        game.audio.jump();
      }

      if (this.jumpHeld && !input.state.jump && this.vy < 0) {
        this.vy *= JUMP_CUTOFF;
        this.jumpHeld = false;
      }
      if (!input.state.jump) this.jumpHeld = false;
    } else {
      this.vx = this.autoVx || 0;
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);

    this.x += this.vx * dt;
    collideX(this, world);
    this.y += this.vy * dt;
    const { ceiling } = collideY(this, world);

    if (ceiling && this._bumpRow != null) {
      world.bumpBlock(Math.floor(this.cx / TILE), this._bumpRow, this, game);
      this._bumpRow = null;
    }

    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }

    if (this.onGround && Math.abs(this.vx) > 12) {
      this.walkTimer += Math.abs(this.vx) * dt;
      this.walkFrame = Math.floor(this.walkTimer / 18) % 2 === 0 ? 1 : 2;
    } else {
      this.walkFrame = 0;
    }

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
        power: this.power,
        invincible: this.invincible > 0,
        star: this.starTime > 0,
        skid: this.skid,
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
    this.state = "walk";
  }
  squash(game) {
    this.state = "squashed";
    this.squashTime = 0.4;
    this.vx = 0;
    game.audio.stomp();
  }
  flip(dir, game) {
    this.state = "flipped";
    this.vy = -320;
    this.vx = 70 * dir;
    game.audio.kick();
  }
  freeze(game) {
    if (this.state === "squashed" || this.state === "flipped") return;
    this.state = "frozen";
    this.freezeTimer = FREEZE_TIME;
    this.vx = 0;
    game.audio.freeze();
  }
  update(dt, world) {
    if (this.state === "squashed") {
      this.squashTime -= dt;
      if (this.squashTime <= 0) this.dead = true;
      return;
    }
    if (this.state === "frozen") {
      this.freezeTimer -= dt;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      collideY(this, world);
      if (this.freezeTimer <= 0) {
        this.state = "walk";
        this.vx = -ENEMY_SPEED;
      }
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
    const box = { x: this.x, y: this.y, w: this.w, h: this.h };
    Sprites.drawGoomba(ctx, box, {
      walkFrame: this.walkFrame,
      squashed: this.state === "squashed",
    });
    if (this.state === "frozen") Sprites.drawFrozenOverlay(ctx, box);
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
    this.state = "walk";
    this.facing = -1;
    this.shellTimer = 0;
  }
  toShell(game) {
    this.state = "shell";
    this.shellTimer = 6;
    this.vx = 0;
    this.h = 26;
    this.y += 14;
    game.audio.stomp();
  }
  kick(dir, game) {
    this.state = "spin";
    this.vx = 330 * dir;
    game.audio.kick();
  }
  stopShell() {
    this.state = "shell";
    this.shellTimer = 6;
    this.vx = 0;
  }
  flip(dir, game) {
    this.state = "flipped";
    this.vy = -320;
    this.vx = 70 * dir;
    game.audio.kick();
  }
  freeze(game) {
    if (this.state === "flipped") return;
    if (this.state === "shell" || this.state === "spin") {
      this.state = "walk";
      this.h = 40;
      this.y -= 14;
    }
    this.state = "frozen";
    this.freezeTimer = FREEZE_TIME;
    this.vx = 0;
    game.audio.freeze();
  }
  update(dt, world) {
    if (this.state === "flipped") {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > world.pixelHeight + 100) this.dead = true;
      return;
    }
    if (this.state === "frozen") {
      this.freezeTimer -= dt;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      collideY(this, world);
      if (this.freezeTimer <= 0) {
        this.state = "walk";
        this.vx = -ENEMY_SPEED;
      }
      return;
    }
    if (this.state === "shell") {
      this.shellTimer -= dt;
      if (this.shellTimer <= 0) {
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
    const box = { x: this.x, y: this.y, w: this.w, h: this.h };
    Sprites.drawKoopa(ctx, box, {
      walkFrame: this.walkFrame,
      facing: this.facing,
      shell: this.state === "shell" || this.state === "spin",
      spinning: this.state === "spin",
    });
    if (this.state === "frozen") Sprites.drawFrozenOverlay(ctx, box);
  }
}

// --------------------------------------------------------------------------
// Piranha Plant — rises out of a pipe on a cycle, ducks when Mario is close.
// --------------------------------------------------------------------------
export class PiranhaPlant extends Body {
  constructor(col, pipeTopRow) {
    // Centered over the two-tile-wide pipe.
    super((col + 1) * TILE - 14, pipeTopRow * TILE, 28, 36);
    this.kind = "piranha";
    this.openingTop = pipeTopRow * TILE;
    this.maxRise = 38;
    this.phase = "down";
    this.timer = 1.0;
    this.rise = 0; // 0 = hidden, maxRise = fully out
    this.mouthTimer = 0;
    this.mouthOpen = false;
    this.pipeCenter = (col + 1) * TILE;
  }
  get active() {
    // Only dangerous when sufficiently out AND Mario isn't standing right by it
    // (you're always safe on/next to the pipe, like the classic games).
    return this.rise > 12 && !this.suppressed;
  }
  update(dt, world, player) {
    const playerNear = player && Math.abs(player.cx - this.pipeCenter) < TILE * 2.6;
    this.suppressed = playerNear;
    // Retract immediately when Mario approaches so he can pass safely.
    if (playerNear) {
      if (this.phase === "rising" || this.phase === "up") this.phase = "lowering";
      else if (this.phase === "down") this.timer = Math.max(this.timer, 0.4);
    }
    switch (this.phase) {
      case "down":
        this.timer -= dt;
        if (this.timer <= 0 && !playerNear) {
          this.phase = "rising";
        }
        break;
      case "rising":
        this.rise = Math.min(this.maxRise, this.rise + 60 * dt);
        if (this.rise >= this.maxRise) {
          this.phase = "up";
          this.timer = 2.0;
        }
        break;
      case "up":
        this.timer -= dt;
        if (this.timer <= 0) this.phase = "lowering";
        break;
      case "lowering":
        this.rise = Math.max(0, this.rise - 60 * dt);
        if (this.rise <= 0) {
          this.phase = "down";
          this.timer = 1.6;
        }
        break;
    }
    this.y = this.openingTop - this.rise;
    this.h = this.rise + 4;
    this.mouthTimer += dt;
    if (this.mouthTimer > 0.3) {
      this.mouthTimer = 0;
      this.mouthOpen = !this.mouthOpen;
    }
  }
  draw(ctx) {
    if (this.rise <= 1) return;
    Sprites.drawPiranha(
      ctx,
      { x: this.x, y: this.openingTop - this.maxRise, w: this.w, h: this.maxRise + 6 },
      { mouthOpen: this.mouthOpen }
    );
  }
}

// --------------------------------------------------------------------------
// Items: Mushroom, Fire Flower, Star
// --------------------------------------------------------------------------
export class Mushroom extends Body {
  constructor(x, y, oneUp = false) {
    super(x, y, 26, 26);
    this.kind = oneUp ? "1up" : "mushroom";
    this.oneUp = oneUp;
    this.vx = 0;
    this.emerging = TILE;
  }
  update(dt, world) {
    if (this.emerging > 0) {
      const rise = 44 * dt;
      this.y -= rise;
      this.emerging -= rise;
      if (this.emerging <= 0) this.vx = ENEMY_SPEED;
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

export class FireFlower extends Body {
  constructor(x, y) {
    super(x, y, 26, 26);
    this.kind = "fire";
    this.emerging = TILE;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.emerging > 0) {
      const rise = 44 * dt;
      this.y -= rise;
      this.emerging -= rise;
    }
  }
  draw(ctx) {
    Sprites.drawFireFlower(ctx, { x: this.x, y: this.y, w: this.w, h: this.h });
  }
}

export class IceFlower extends Body {
  constructor(x, y) {
    super(x, y, 26, 26);
    this.kind = "iceflower";
    this.emerging = TILE;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.emerging > 0) {
      const rise = 44 * dt;
      this.y -= rise;
      this.emerging -= rise;
    }
  }
  draw(ctx) {
    Sprites.drawIceFlower(ctx, { x: this.x, y: this.y, w: this.w, h: this.h });
  }
}

export class Star extends Body {
  constructor(x, y) {
    super(x, y, 26, 26);
    this.kind = "star";
    this.emerging = TILE;
    this.t = 0;
  }
  update(dt, world) {
    this.t += dt;
    if (this.emerging > 0) {
      const rise = 44 * dt;
      this.y -= rise;
      this.emerging -= rise;
      if (this.emerging <= 0) {
        this.vx = ENEMY_SPEED * 1.4;
        this.vy = -260;
      }
      return;
    }
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.x += this.vx * dt;
    if (collideX(this, world)) this.vx = -this.vx;
    this.y += this.vy * dt;
    const { ground } = collideY(this, world);
    if (ground) this.vy = -320; // bounce
    if (this.y > world.pixelHeight + 100) this.dead = true;
  }
  draw(ctx) {
    Sprites.drawStar(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t);
  }
}

// --------------------------------------------------------------------------
// Projectile thrown by fire/ice Mario.
// --------------------------------------------------------------------------
export class Fireball extends Body {
  constructor(x, y, dir, type = "fire") {
    super(x, y, 14, 14);
    this.kind = "fireball";
    this.type = type; // "fire" | "ice"
    this.vx = FIREBALL_SPEED * dir;
    this.vy = 120;
    this.life = 2.5;
    this.t = 0;
  }
  update(dt, world) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * 0.9 * dt);
    this.x += this.vx * dt;
    if (collideX(this, world)) this.dead = true; // pop on walls
    this.y += this.vy * dt;
    const { ground } = collideY(this, world);
    if (ground) this.vy = FIREBALL_BOUNCE; // bounce along the ground
    if (this.y > world.pixelHeight + 100) this.dead = true;
  }
  draw(ctx) {
    Sprites.drawFireball(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t, this.type);
  }
}

// --------------------------------------------------------------------------
// Boss (Bowser & variants). Patrols, jumps, hurls projectiles, takes several
// hits, and can rage into a tougher second phase.
// --------------------------------------------------------------------------
export class Bowser extends Body {
  constructor(col, row, opts = {}) {
    super(col * TILE, (row + 1) * TILE - 64, 56, 64);
    this.kind = "boss";
    this.variant = opts.variant || "bowser";
    this.name = opts.name || "BOWSER";
    this.tint = opts.tint || null;
    this.hpPerPhase = opts.hp || BOSS_HP;
    this.maxPhase = opts.phases || 1;
    this.phase = 1;
    this.hp = this.hpPerPhase;
    this.speed = opts.speed || 75;
    this.fireInterval = opts.fireInterval || 1.8;
    this.jumpInterval = opts.jumpInterval || 2.2;
    this.arc = !!opts.arc; // lobbed (hammer) projectiles
    this.spread = opts.spread || 1; // projectiles per volley
    this.facing = -1;
    this.vx = -this.speed;
    this.minX = Math.max(TILE, (col - 5) * TILE);
    this.maxX = (col + 2) * TILE;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.jumpTimer = this.jumpInterval;
    this.fireTimer = this.fireInterval;
    this.invuln = 0;
    this.enraged = false;
    this.state = "alive"; // alive | dead
    this.deadTimer = 0;
  }
  nextPhase(game) {
    this.phase += 1;
    this.hp = this.hpPerPhase;
    this.invuln = 1.4;
    this.enraged = true;
    this.speed *= 1.4;
    this.vx = this.vx < 0 ? -this.speed : this.speed;
    this.fireInterval *= 0.6;
    this.jumpInterval *= 0.7;
    this.spread = Math.min(3, this.spread + 1);
    game.audio.bossRoar();
  }
  hit(game) {
    if (this.state !== "alive" || this.invuln > 0) return false;
    this.hp -= 1;
    this.invuln = 0.8;
    game.audio.bossHit();
    if (this.hp <= 0) {
      if (this.phase < this.maxPhase) {
        this.nextPhase(game);
      } else {
        this.state = "dead";
        this.vx = 0;
        this.vy = -220;
      }
    }
    return true;
  }
  update(dt, world, player, game) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.state === "dead") {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.deadTimer += dt;
      return;
    }
    if (player) this.facing = player.cx < this.cx ? -1 : 1;

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.x += this.vx * dt;
    if (this.x < this.minX) {
      this.x = this.minX;
      this.vx = Math.abs(this.vx);
    } else if (this.x > this.maxX) {
      this.x = this.maxX;
      this.vx = -Math.abs(this.vx);
    }
    this.y += this.vy * dt;
    collideY(this, world);

    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0 && this.onGround) {
      this.vy = -560;
      this.jumpTimer = this.jumpInterval + Math.random();
      game.audio.bossRoar();
    }
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireInterval + Math.random() * 0.5;
      game.spawnBossFire(this, player);
    }
    this.walkTimer += dt;
    if (this.walkTimer > 0.2) {
      this.walkTimer = 0;
      this.walkFrame ^= 1;
    }
  }
  draw(ctx) {
    Sprites.drawBowser(
      ctx,
      { x: this.x, y: this.y, w: this.w, h: this.h },
      {
        facing: this.facing,
        walkFrame: this.walkFrame,
        hurt: this.invuln > 0,
        dead: this.state === "dead",
        tint: this.enraged ? "#ff4040" : this.tint,
      }
    );
  }
}

// A boss projectile — straight fire breath or a lobbed hammer (arc).
export class BossFireball extends Body {
  constructor(x, y, vx, vy, arc = false) {
    super(x, y, 20, 18);
    this.kind = "bossfire";
    this.vx = vx;
    this.vy = vy;
    this.arc = arc;
    this.life = 4.5;
    this.t = 0;
  }
  update(dt, world) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.vy += GRAVITY * (this.arc ? 0.6 : 0.18) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (world.isSolid(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE))) this.dead = true;
    if (this.y > world.pixelHeight + 100 || this.x < -60) this.dead = true;
  }
  draw(ctx) {
    if (this.arc) {
      Sprites.drawHammer(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t);
    } else {
      Sprites.drawFireball(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t, "fire");
    }
  }
}

// The bridge axe — touch to instantly defeat the boss.
export class Axe extends Body {
  constructor(col, row) {
    super(col * TILE + 4, row * TILE, 24, 28);
    this.kind = "axe";
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
  }
  draw(ctx) {
    Sprites.drawAxe(ctx, { x: this.x, y: this.y, w: this.w, h: this.h });
  }
}

// --------------------------------------------------------------------------
// Particles + floating score text
// --------------------------------------------------------------------------
export class Particle extends Body {
  constructor(x, y, vx, vy, color, size = 6, life = 0.9, gravity = 0.7) {
    super(x, y, size, size);
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.grav = gravity;
  }
  update(dt) {
    this.vy += GRAVITY * this.grav * dt;
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
