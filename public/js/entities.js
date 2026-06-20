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
  TAIL_GLIDE_VY,
  TAIL_SPIN_TIME,
  BOOMERANG_SPEED,
  BOOMERANG_RANGE,
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
    this.power = "small"; // small | big | fire | ice | tail | boomerang
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
    this.squashTimer = 0;
    this._wasGround = false;
    this._dustT = 0;
    this.spinTimer = 0; // tail-spin attack window
    this.spinCooldown = 0;
    this.gliding = false; // leaf slow-fall this frame (for the draw + dust)
  }

  // Forms that throw/act on the "run" button instead of just running.
  get armed() {
    return this.power === "fire" || this.power === "ice" || this.power === "boomerang";
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
    if (this.spinCooldown > 0) this.spinCooldown -= dt;
    if (this.spinTimer > 0) this.spinTimer -= dt;
    this.gliding = false;

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

      // The "run" button doubles as the action button for armed forms:
      // fire/ice throw a ball, boomerang throws a boomerang, leaf tail-spins.
      if (this.fireCooldown <= 0 && input.consume("run")) {
        if (this.armed && (this.power === "fire" || this.power === "ice")) {
          if (game.spawnFireball(this)) this.fireCooldown = 0.28;
        } else if (this.power === "boomerang") {
          if (game.spawnBoomerang(this)) this.fireCooldown = 0.25;
        } else if (this.power === "tail" && this.spinCooldown <= 0) {
          this.spinTimer = TAIL_SPIN_TIME;
          this.spinCooldown = 0.5;
          game.tailSpin?.(this);
          game.audio.kick();
        }
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

    // Leaf glide: wag the tail (hold jump) while falling to drift down slowly.
    if (
      this.power === "tail" &&
      this.controllable &&
      !this.onGround &&
      this.vy > 0 &&
      input.state.jump
    ) {
      if (this.vy > TAIL_GLIDE_VY) this.vy = TAIL_GLIDE_VY;
      this.gliding = true;
    }

    this.x += this.vx * dt;
    collideX(this, world);
    const fallVy = this.vy; // speed just before vertical resolution
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

    // Squash/stretch + dust feedback.
    if (this.squashTimer > 0) this.squashTimer -= dt;
    if (this.onGround && !this._wasGround && fallVy > 240) {
      this.squashTimer = 0.12;
      game.spawnDust?.(this.cx, this.y + this.h, fallVy > 600 ? 8 : 5);
      if (fallVy > 640) game.addShake?.(2);
    }
    this._wasGround = this.onGround;
    if (this.onGround && Math.abs(this.vx) > 220) {
      this._dustT = (this._dustT || 0) + dt;
      if (this._dustT > 0.09) {
        this._dustT = 0;
        game.spawnDust?.(this.cx - this.facing * 8, this.y + this.h, 2);
      }
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
    // Squash on landing, stretch in the air — subtle game feel.
    let sx = 1, sy = 1;
    if (this.squashTimer > 0) {
      sx = 1.15;
      sy = 0.85;
    } else if (!this.onGround) {
      if (this.vy < 0) {
        sx = 0.9;
        sy = 1.12;
      } else {
        sx = 0.96;
        sy = 1.05;
      }
    }
    const cx = this.x + this.w / 2;
    const feet = this.y + this.h;
    ctx.save();
    // Tail-spin: whirl the whole sprite around its centre.
    if (this.spinTimer > 0) {
      const mid = this.y + this.h / 2;
      ctx.translate(cx, mid);
      ctx.rotate(this.facing * (1 - this.spinTimer / TAIL_SPIN_TIME) * Math.PI * 2);
      ctx.translate(-cx, -mid);
    }
    ctx.translate(cx, feet);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -feet);
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
        gliding: this.gliding,
        spinning: this.spinTimer > 0,
      }
    );
    ctx.restore();
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
// Spiny — a spiked enemy. Walks and turns at ledges like a Goomba, but its
// back is covered in spikes, so stomping it hurts you. Defeat it with a
// fireball, a star, a kicked shell, or freeze it with an iceball.
// --------------------------------------------------------------------------
export class Spiny extends Body {
  constructor(col, row) {
    super(col * TILE + 4, row * TILE + 6, 26, 26);
    this.kind = "spiny";
    this.vx = 0; // holds its ground: a planted spiked hazard you must leap
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.facing = -1;
    this.state = "walk";
  }
  flip(dir, game) {
    this.state = "flipped";
    this.vy = -320;
    this.vx = 70 * dir;
    game.audio.kick();
  }
  freeze(game) {
    if (this.state === "flipped") return;
    this.state = "frozen";
    this.freezeTimer = FREEZE_TIME;
    this.vx = 0;
    game.audio.freeze();
  }
  update(dt, world) {
    if (this.state === "frozen") {
      this.freezeTimer -= dt;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      collideY(this, world);
      if (this.freezeTimer <= 0) this.state = "walk";
      return;
    }
    if (this.state === "flipped") {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > world.pixelHeight + 100) this.dead = true;
      return;
    }
    // Planted in place: only gravity keeps it seated. It never wanders into
    // pits or under blocks, so it stays a fair, leap-able hazard.
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;
    collideY(this, world);
    if (this.y > world.pixelHeight + 100) this.dead = true;
    this.walkTimer += dt;
    if (this.walkTimer > 0.22) {
      this.walkTimer = 0;
      this.walkFrame ^= 1;
    }
  }
  draw(ctx) {
    const box = { x: this.x, y: this.y, w: this.w, h: this.h };
    Sprites.drawSpiny(ctx, box, { walkFrame: this.walkFrame, facing: this.facing });
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

// Super Leaf — grants the raccoon tail (glide + tail-spin). It flutters as it
// emerges from a block, like the classic SMB3 leaf.
export class SuperLeaf extends Body {
  constructor(x, y) {
    super(x, y, 26, 24);
    this.kind = "leaf";
    this.emerging = TILE;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.emerging > 0) {
      const rise = 44 * dt;
      this.y -= rise;
      this.emerging -= rise;
    } else {
      // gentle fluttering bob once it has popped out
      this.x += Math.sin(this.t * 6) * 18 * dt;
    }
  }
  draw(ctx) {
    Sprites.drawSuperLeaf(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t);
  }
}

export class BoomerangFlower extends Body {
  constructor(x, y) {
    super(x, y, 26, 26);
    this.kind = "boomerangflower";
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
    Sprites.drawBoomerangFlower(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t);
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
// Boomerang — flies out in a straight line, then curves back toward the thrower
// (hitting enemies both ways). The owner can catch it to throw again sooner;
// otherwise it expires once it has returned. Ignores walls/gravity.
// --------------------------------------------------------------------------
export class Boomerang extends Body {
  constructor(x, y, dir, owner) {
    super(x, y, 18, 18);
    this.kind = "boomerang";
    this.owner = owner;
    this.dir = dir;
    this.vx = BOOMERANG_SPEED * dir;
    this.startX = x;
    this.phase = "out"; // out | back
    this.t = 0;
    this.life = 3;
  }
  update(dt, world) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.phase === "out") {
      // Decelerate so it stalls after ~BOOMERANG_RANGE px, then flip to "back".
      const decel = (BOOMERANG_SPEED * BOOMERANG_SPEED) / (2 * BOOMERANG_RANGE);
      this.vx -= this.dir * decel * dt;
      if (Math.sign(this.vx) !== this.dir) this.phase = "back";
    } else {
      // home back toward the owner
      const target = this.owner && this.owner.alive ? this.owner.cx : this.startX;
      const toward = Math.sign(target - this.cx) || -this.dir;
      this.vx += toward * 1700 * dt;
      this.vx = Math.max(-BOOMERANG_SPEED * 1.2, Math.min(BOOMERANG_SPEED * 1.2, this.vx));
      if (this.owner && this.owner.alive && this.intersects(this.owner)) this.dead = true; // caught
    }
    this.x += this.vx * dt;
    this.y += Math.sin(this.t * 10) * 24 * dt; // gentle wobble
    if (this.x < -80 || this.x > world.pixelWidth + 80) this.dead = true;
  }
  draw(ctx) {
    Sprites.drawBoomerang(ctx, { x: this.x, y: this.y, w: this.w, h: this.h }, this.t);
  }
}

// --------------------------------------------------------------------------
// Paratroopa — a winged Koopa that hops in place. Stomping it shears the wings
// and drops a regular walking Koopa (classic SMB behaviour). Until then it can
// also be flipped by fire/shell/star or frozen by ice.
// --------------------------------------------------------------------------
export class Paratroopa extends Body {
  constructor(col, row) {
    super(col * TILE + 4, row * TILE - 8, 26, 40);
    this.kind = "paratroopa";
    this.homeY = this.y;
    this.vx = 0;
    this.vy = -260;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.facing = -1;
    this.state = "walk"; // walk(=hopping) | frozen | flipped
  }
  flip(dir, game) {
    this.state = "flipped";
    this.vy = -320;
    this.vx = 70 * dir;
    game.audio.kick();
  }
  freeze(game) {
    if (this.state === "flipped") return;
    this.state = "frozen";
    this.freezeTimer = FREEZE_TIME;
    this.vx = 0;
    game.audio.freeze();
  }
  // Convert into a grounded Koopa where it currently sits.
  deWing() {
    const koopa = new Koopa(0, 0);
    koopa.x = this.x;
    koopa.y = this.homeY + 8;
    koopa.vx = -ENEMY_SPEED;
    koopa.state = "walk";
    this.dead = true;
    return koopa;
  }
  update(dt, world) {
    if (this.state === "frozen") {
      this.freezeTimer -= dt;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      collideY(this, world);
      if (this.freezeTimer <= 0) this.state = "walk";
      return;
    }
    if (this.state === "flipped") {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > world.pixelHeight + 100) this.dead = true;
      return;
    }
    // Bounce in place around its home height.
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;
    if (this.y >= this.homeY) {
      this.y = this.homeY;
      this.vy = -260; // hop back up
    }
    this.walkTimer += dt;
    if (this.walkTimer > 0.12) {
      this.walkTimer = 0;
      this.walkFrame ^= 1;
    }
  }
  draw(ctx) {
    const box = { x: this.x, y: this.y, w: this.w, h: this.h };
    Sprites.drawParatroopa(ctx, box, { walkFrame: this.walkFrame, facing: this.facing });
    if (this.state === "frozen") Sprites.drawFrozenOverlay(ctx, box);
  }
}

// --------------------------------------------------------------------------
// Boss (Bowser & the Hammer King mini-boss). A telegraphed attack state
// machine: it patrols toward you, then chooses from several moves — breathe,
// spread, lobbed hammers, a leaping ground slam, or a rushing charge. Hits take
// it down; ice stuns it; it rages into a faster second phase.
// --------------------------------------------------------------------------
export class Bowser extends Body {
  constructor(col, row, opts = {}) {
    super(col * TILE, (row + 1) * TILE - 72, 64, 72);
    this.kind = "boss";
    this.variant = opts.variant || "bowser";
    this.name = opts.name || "BOWSER";
    this.tint = opts.tint || null;
    this.hpPerPhase = opts.hp || BOSS_HP;
    this.maxPhase = opts.phases || 1;
    this.phase = 1;
    this.hp = this.hpPerPhase;
    this.speed = opts.speed || 70;
    this.facing = -1;
    this.minX = Math.max(TILE, (col - 5) * TILE);
    this.maxX = (col + 2) * TILE;
    this.walkFrame = 0;
    this.walkAnim = 0;
    this.invuln = 0;
    this.stunTimer = 0;
    this.enraged = false;
    this.state = "alive"; // alive | dead
    this.deadTimer = 0;
    // attack state machine
    this.action = "walk";
    this.moveTimer = 1.2;
    this.tTimer = 0;
    this.cTimer = 0;
    this.pending = null;
    this.telegraph = false;
    this.slamPending = false;
  }
  get cooldown() {
    return this.enraged ? 0.8 : 1.5;
  }
  get telegraphDur() {
    return this.enraged ? 0.32 : 0.5;
  }
  nextPhase(game) {
    this.phase += 1;
    this.hp = this.hpPerPhase;
    this.invuln = 1.4;
    this.enraged = true;
    this.speed *= 1.4;
    this.action = "walk";
    this.moveTimer = 0.6;
    game.audio.bossRoar();
  }
  hit(game) {
    if (this.state !== "alive" || this.invuln > 0) return false;
    this.hp -= 1;
    this.invuln = 0.8;
    game.audio.bossHit();
    if (this.hp <= 0) {
      if (this.phase < this.maxPhase) this.nextPhase(game);
      else {
        this.state = "dead";
        this.vx = 0;
        this.vy = -220;
      }
    }
    return true;
  }
  stun(game) {
    if (this.state !== "alive") return false;
    this.stunTimer = 1.6;
    this.action = "walk";
    this.telegraph = false;
    this.vx = 0;
    game.audio.freeze();
    return true;
  }
  _pickMove() {
    const base =
      this.variant === "mini"
        ? ["hammers", "hammers", "charge", "slam"]
        : ["breathe", "spread", "slam", "charge"];
    if (this.phase >= 2) base.push("spread", "breathe", "charge");
    if (this.phase >= 3) base.push("rain", "rain", "spread"); // final-phase fury
    return base[(Math.random() * base.length) | 0];
  }
  update(dt, world, player, game) {
    if (this.invuln > 0) this.invuln -= dt;
    this.walkAnim += dt;
    if (this.walkAnim > 0.18) {
      this.walkAnim = 0;
      this.walkFrame ^= 1;
    }

    if (this.state === "dead") {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.deadTimer += dt;
      return;
    }

    const grav = () => {
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      collideY(this, world);
    };
    const clampX = () => {
      if (this.x < this.minX) this.x = this.minX;
      else if (this.x > this.maxX) this.x = this.maxX;
    };

    // Stunned by ice: frozen in place (a window to attack it).
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vx = 0;
      grav();
      return;
    }

    if (player) this.facing = player.cx < this.cx ? -1 : 1;

    switch (this.action) {
      case "walk": {
        // Stalk toward the player.
        const dir = player ? (player.cx < this.cx ? -1 : 1) : -1;
        this.vx = dir * this.speed;
        this.x += this.vx * dt;
        clampX();
        grav();
        this.moveTimer -= dt;
        if (this.moveTimer <= 0 && this.onGround) {
          this.pending = this._pickMove();
          this.action = "telegraph";
          this.tTimer = this.telegraphDur;
          this.telegraph = true;
          this.vx = 0;
        }
        break;
      }
      case "telegraph": {
        grav();
        this.tTimer -= dt;
        if (this.tTimer <= 0) {
          this.telegraph = false;
          this._execute(this.pending, player, game);
        }
        break;
      }
      case "charge": {
        this.x += this.vx * dt;
        clampX();
        grav();
        this.cTimer -= dt;
        if (this.cTimer <= 0 || this.x <= this.minX || this.x >= this.maxX) {
          this.action = "walk";
          this.moveTimer = this.cooldown;
        }
        break;
      }
      case "air": {
        this.x += this.vx * dt;
        clampX();
        grav();
        if (this.onGround) {
          if (this.slamPending) {
            this.slamPending = false;
            game.bossShock(this);
          }
          this.action = "walk";
          this.moveTimer = this.cooldown;
        }
        break;
      }
      default:
        grav();
    }
  }
  _execute(move, player, game) {
    switch (move) {
      case "breathe":
        game.bossBreathe(this, player);
        this.action = "walk";
        this.moveTimer = this.cooldown;
        break;
      case "spread":
        game.bossSpread(this, player);
        this.action = "walk";
        this.moveTimer = this.cooldown;
        break;
      case "hammers":
        game.bossHammers(this, player);
        this.action = "walk";
        this.moveTimer = this.cooldown;
        break;
      case "rain":
        game.bossRain(this, player);
        this.action = "walk";
        this.moveTimer = this.cooldown;
        break;
      case "slam":
        this.vy = -740;
        this.vx = this.facing * 80;
        this.slamPending = true;
        this.action = "air";
        game.audio.bossRoar();
        break;
      case "charge":
        this.vx = this.facing * (this.enraged ? 430 : 350);
        this.cTimer = 0.7;
        this.action = "charge";
        game.audio.bossRoar();
        break;
      default:
        this.action = "walk";
        this.moveTimer = this.cooldown;
    }
  }
  draw(ctx) {
    const draw = this.variant === "mini" ? Sprites.drawHammerKing : Sprites.drawBowser;
    draw(
      ctx,
      { x: this.x, y: this.y, w: this.w, h: this.h },
      {
        facing: this.facing,
        walkFrame: this.walkFrame,
        hurt: this.invuln > 0,
        dead: this.state === "dead",
        stunned: this.stunTimer > 0,
        telegraph: this.telegraph,
        tint: this.enraged ? "#ff4040" : this.tint,
      }
    );
  }
}

// A boss projectile: straight fire breath, a lobbed hammer (arc), or a ground
// shockwave that skims along the floor.
export class BossFireball extends Body {
  constructor(x, y, vx, vy, mode = "fire") {
    super(x, y, mode === "shock" ? 22 : 20, mode === "shock" ? 22 : 18);
    this.kind = "bossfire";
    this.vx = vx;
    this.vy = vy;
    this.mode = mode;
    this.life = mode === "shock" ? 2.2 : 4.5;
    this.t = 0;
  }
  update(dt, world) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    const g = this.mode === "hammer" ? 0.6 : this.mode === "shock" ? 0 : 0.18;
    this.vy += GRAVITY * g * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Shockwaves ride the floor and ignore the ground tile they sit on.
    if (this.mode !== "shock" && world.isSolid(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE)))
      this.dead = true;
    if (this.y > world.pixelHeight + 100 || this.x < -60 || this.x > world.pixelWidth + 60)
      this.dead = true;
  }
  draw(ctx) {
    const box = { x: this.x, y: this.y, w: this.w, h: this.h };
    if (this.mode === "hammer") Sprites.drawHammer(ctx, box, this.t);
    else if (this.mode === "shock") Sprites.drawShockwave(ctx, box, this.t);
    else Sprites.drawFireball(ctx, box, this.t, "fire");
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
