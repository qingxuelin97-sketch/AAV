// The Game orchestrates state, the world, entities, camera, scoring and the
// main loop. UI/overlay concerns live in main.js and are reached via hooks.

import {
  TILE,
  VIEW_W,
  VIEW_H,
  GRAVITY,
  STOMP_BOUNCE,
  T,
  STATE,
} from "./constants.js";
import { LEVELS } from "./levels.js";
import { World } from "./world.js";
import { Player, Goomba, Koopa, Mushroom, Particle, FloatingText } from "./entities.js";
import { drawBackground, drawWorld, drawCastle } from "./render.js";
import { drawCoin } from "./sprites.js";

const SLIDE_SPEED = 240;
const WALK_OFF_SPEED = 95;
const COINS_FOR_1UP = 100;

class CoinPop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = -280;
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.vy += 900 * dt;
    if (this.t > 0.5) this.dead = true;
  }
  draw(ctx) {
    drawCoin(ctx, { x: this.x + 6, y: this.y + 4, w: 20, h: 24 }, this.t * 10);
  }
}

export class Game {
  constructor(canvas, input, audio, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.input = input;
    this.audio = audio;
    this.hooks = hooks;

    this.state = STATE.TITLE;
    this.cam = { x: 0 };
    this.time = 0;
    this._raf = null;
    this._last = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.levelIndex = 0;
  }

  // ---- lifecycle ---------------------------------------------------------
  start() {
    this.reset();
    this.audio.unlock();
    this.loadLevel(0);
    this.state = STATE.PLAYING;
    this.audio.startMusic();
    this.emitHud();
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.world = new World(def);
    this.timeLeft = def.time;

    // Extract enemy spawns; coins remain as tiles.
    this.entities = [];
    for (let row = 0; row < this.world.rows; row++) {
      for (let col = 0; col < this.world.cols; col++) {
        const ch = this.world.tile(col, row);
        if (ch === T.GOOMBA) {
          this.entities.push(new Goomba(col, row));
          this.world.setTile(col, row, T.EMPTY);
        } else if (ch === T.KOOPA) {
          this.entities.push(new Koopa(col, row));
          this.world.setTile(col, row, T.EMPTY);
        }
      }
    }

    this.particles = [];
    this.floatingTexts = [];
    this.coinPops = [];

    // Spawn the player on the ground near the left edge.
    const startCol = 3;
    let startRow = 0;
    for (let r = 0; r < this.world.rows; r++) {
      if (this.world.isSolid(startCol, r)) {
        startRow = r;
        break;
      }
    }
    this.player = new Player(startCol * TILE, (startRow - 1) * TILE);
    if (this._wasBig) this.player.setPower("big");

    this.cam.x = 0;
    this.clearPhase = null;
    this.flagClothY = 3 * TILE;
    this.hooks.onPause?.(false);
  }

  restartLevel() {
    this._wasBig = false; // lose power on death
    this.loadLevel(this.levelIndex);
    this.state = STATE.PLAYING;
    this.audio.startMusic();
    this.emitHud();
  }

  nextLevel() {
    this._wasBig = this.player.power === "big";
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.win();
    } else {
      this.loadLevel(this.levelIndex + 1);
      this.state = STATE.PLAYING;
      this.audio.startMusic();
      this.emitHud();
    }
  }

  win() {
    this.state = STATE.WIN;
    this.audio.stopMusic();
    this.audio.win();
    this.hooks.onWin?.(this.stats());
  }

  gameOver() {
    this.state = STATE.GAMEOVER;
    this.audio.stopMusic();
    this.hooks.onGameOver?.(this.stats());
  }

  stats() {
    return {
      score: this.score,
      coins: this.coins,
      level: this.levelIndex + 1,
      timeMs: Math.round(this.elapsedMs || 0),
    };
  }

  // ---- scoring -----------------------------------------------------------
  addScore(n) {
    this.score += n;
  }

  collectCoin(x, y, points = 200, popup = true) {
    this.coins++;
    this.addScore(points);
    this.audio.coin();
    if (popup) this.floatingTexts.push(new FloatingText(x - this.cam.x, y, String(points), "#ffd23f"));
    if (this.coins >= COINS_FOR_1UP) {
      this.coins -= COINS_FOR_1UP;
      this.lives++;
      this.audio.oneUp();
      this.floatingTexts.push(new FloatingText(this.player.cx - this.cam.x, this.player.y, "1UP", "#5fe06b"));
    }
  }

  spawnCoinPop(x, y) {
    this.coinPops.push(new CoinPop(x, y));
  }

  popText(worldX, worldY, text, color) {
    this.floatingTexts.push(new FloatingText(worldX - this.cam.x, worldY, text, color));
  }

  // ---- death -------------------------------------------------------------
  killPlayer() {
    if (this.state === STATE.DYING) return;
    this.state = STATE.DYING;
    this.deathTimer = 0;
    this.player.alive = false;
    this.player.controllable = false;
    this.player.vy = -560;
    this.audio.stopMusic();
    this.audio.death();
    this.emitHud();
  }

  // ---- main update -------------------------------------------------------
  update(dt) {
    this.time += dt;

    // Global toggles.
    if (this.input.consume("mute")) {
      const muted = this.audio.toggleMute();
      this.hooks.onMute?.(muted);
    }
    if (this.input.consume("pause")) {
      if (this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED;
        this.audio.stopMusic();
        this.hooks.onPause?.(true);
      } else if (this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING;
        this.audio.startMusic();
        this.hooks.onPause?.(false);
      }
    }

    switch (this.state) {
      case STATE.PLAYING:
        this.updatePlaying(dt);
        break;
      case STATE.DYING:
        this.updateDying(dt);
        break;
      case STATE.LEVEL_CLEAR:
        this.updateClear(dt);
        break;
      default:
        break;
    }
  }

  updatePlaying(dt) {
    this.elapsedMs = (this.elapsedMs || 0) + dt * 1000;

    // Countdown (runs ~2x real time, classic feel).
    this.timeLeft -= dt * 2;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.killPlayer();
      return;
    }

    const world = this.world;
    this.player.update(dt, this.input, world, this);
    world.update(dt);

    // Collect coin tiles overlapping the player.
    this.collectCoinTiles();

    // Update entities within an activation window around the camera.
    const lo = this.cam.x - 96;
    const hi = this.cam.x + VIEW_W + 96;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.x + e.w < lo || e.x > hi) continue;
      if (e.contactCooldown > 0) e.contactCooldown -= dt;
      e.update(dt, world);
    }

    this.handleEnemyCollisions();
    this.handleShellCollisions();
    this.handleItemCollisions();

    for (const p of this.particles) p.update(dt);
    for (const f of this.floatingTexts) f.update(dt);
    for (const c of this.coinPops) c.update(dt);

    this.entities = this.entities.filter((e) => !e.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.floatingTexts = this.floatingTexts.filter((f) => !f.dead);
    this.coinPops = this.coinPops.filter((c) => !c.dead);

    this.updateCamera();

    // Reached the flagpole?
    if (this.player.cx >= world.flagCol * TILE) {
      this.startFlag();
    }

    this.emitHud();
  }

  collectCoinTiles() {
    const p = this.player;
    const c0 = Math.floor(p.x / TILE);
    const c1 = Math.floor((p.x + p.w - 1) / TILE);
    const r0 = Math.floor(p.y / TILE);
    const r1 = Math.floor((p.y + p.h - 1) / TILE);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (this.world.tile(c, r) === T.COIN) {
          this.world.setTile(c, r, T.EMPTY);
          this.collectCoin(c * TILE + TILE / 2, r * TILE, 200, false);
        }
      }
    }
  }

  handleEnemyCollisions() {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.entities) {
      if (e.dead || !(e instanceof Goomba || e instanceof Koopa)) continue;
      if (!p.intersects(e)) continue;

      const pBottom = p.y + p.h;
      const falling = p.vy > 0;
      const stomp = falling && pBottom - e.y < e.h * 0.7;

      if (e instanceof Goomba) {
        if (e.state === "walk") {
          if (stomp) {
            e.squash(this);
            p.vy = STOMP_BOUNCE;
            this.addScore(100);
            this.popText(e.cx, e.y, "100");
          } else {
            p.damage(this);
          }
        }
      } else if (e instanceof Koopa) {
        if (e.state === "walk") {
          if (stomp) {
            e.toShell(this);
            p.vy = STOMP_BOUNCE;
            this.addScore(100);
            this.popText(e.cx, e.y, "100");
          } else {
            p.damage(this);
          }
        } else if (e.state === "shell") {
          // Kick the idle shell away from the player.
          const dir = p.cx < e.cx ? 1 : -1;
          e.kick(dir, this);
          e.contactCooldown = 0.18;
          if (stomp) p.vy = STOMP_BOUNCE;
          this.addScore(100);
          this.popText(e.cx, e.y, "100");
        } else if (e.state === "spin") {
          if (stomp) {
            e.stopShell();
            p.vy = STOMP_BOUNCE;
          } else if (!(e.contactCooldown > 0)) {
            p.damage(this);
          }
        }
      }
    }
  }

  // A spinning shell mows down other enemies.
  handleShellCollisions() {
    for (const shell of this.entities) {
      if (shell.dead || !(shell instanceof Koopa) || shell.state !== "spin") continue;
      for (const e of this.entities) {
        if (e === shell || e.dead) continue;
        if (!(e instanceof Goomba || e instanceof Koopa)) continue;
        if (e.state === "squashed" || e.state === "flipped") continue;
        if (shell.intersects(e)) {
          const dir = shell.vx > 0 ? 1 : -1;
          e.flip(dir, this);
          this.addScore(200);
          this.popText(e.cx, e.y, "200");
        }
      }
    }
  }

  handleItemCollisions() {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.entities) {
      if (e.dead || !(e instanceof Mushroom)) continue;
      if (!p.intersects(e)) continue;
      e.dead = true;
      if (e.oneUp) {
        this.lives++;
        this.audio.oneUp();
        this.popText(e.cx, e.y, "1UP", "#5fe06b");
      } else {
        if (p.power === "small") {
          p.setPower("big");
          this.audio.powerup();
        }
        this.addScore(1000);
        this.popText(e.cx, e.y, "1000", "#fff");
      }
    }
  }

  updateCamera() {
    const target = this.player.cx - VIEW_W * 0.42;
    const max = this.world.pixelWidth - VIEW_W;
    this.cam.x = Math.max(0, Math.min(max, target));
  }

  // ---- death animation ---------------------------------------------------
  updateDying(dt) {
    this.deathTimer += dt;
    const p = this.player;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    for (const f of this.floatingTexts) f.update(dt);
    this.floatingTexts = this.floatingTexts.filter((f) => !f.dead);

    if (this.deathTimer > 2.0) {
      this.lives--;
      if (this.lives < 0) {
        this.gameOver();
      } else {
        this.restartLevel();
      }
    }
  }

  // ---- flag / level clear -------------------------------------------------
  startFlag() {
    this.state = STATE.LEVEL_CLEAR;
    const p = this.player;
    p.controllable = false;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.x = this.world.flagCol * TILE - p.w + 4;
    this.clearPhase = "slide";
    this.clearTimer = 0;
    this.audio.stopMusic();
    this.audio.flag();

    // Flag score by how high up the pole Mario grabbed it.
    const poleTop = 3 * TILE;
    const grabFrac = 1 - Math.min(1, Math.max(0, (p.y - poleTop) / (this.world.pixelHeight - poleTop)));
    const bonus = [100, 400, 800, 2000, 5000][Math.min(4, Math.floor(grabFrac * 5))];
    this.addScore(bonus);
    this.popText(p.cx + 30, p.y, String(bonus), "#fff");
  }

  updateClear(dt) {
    const p = this.player;
    const groundY = (this.world.rows - 2) * TILE - p.h;

    if (this.clearPhase === "slide") {
      p.y = Math.min(groundY, p.y + SLIDE_SPEED * dt);
      this.flagClothY = Math.min((this.world.rows - 3) * TILE, p.y);
      this.player.walkFrame = 0;
      if (p.y >= groundY) {
        this.clearPhase = "pause";
        this.clearTimer = 0;
      }
    } else if (this.clearPhase === "pause") {
      this.clearTimer += dt;
      if (this.clearTimer > 0.5) {
        this.clearPhase = "walk";
        p.facing = 1;
        p.x += 10;
      }
    } else if (this.clearPhase === "walk") {
      p.x += WALK_OFF_SPEED * dt;
      this.player.walkTimer += WALK_OFF_SPEED * dt;
      this.player.walkFrame = Math.floor(this.player.walkTimer / 18) % 2 === 0 ? 1 : 2;
      this.updateCamera();
      if (p.x > (this.world.flagCol + 6) * TILE) {
        // Tally remaining time into score, then advance.
        const timeBonus = Math.floor(this.timeLeft) * 50;
        this.addScore(timeBonus);
        this.nextLevel();
      }
    }
    this.emitHud();
  }

  // ---- rendering ---------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.state === STATE.TITLE) {
      // A calm parallax scene behind the title overlay.
      drawBackground(ctx, this.cam, LEVELS[0]);
      return;
    }

    const def = LEVELS[this.levelIndex];
    drawBackground(ctx, this.cam, def);

    // Decorative castle just past the flag.
    const castleX = (this.world.flagCol + 8) * TILE - this.cam.x;
    if (castleX < VIEW_W + 200 && castleX > -300) {
      drawCastle(ctx, castleX, (this.world.rows - 2) * TILE);
    }

    drawWorld(ctx, this.world, this.cam, this.time);

    // Flag cloth on the pole.
    this.drawFlagCloth(ctx);

    // Entities.
    ctx.save();
    ctx.translate(-this.cam.x, 0);
    for (const e of this.entities) e.draw(ctx);
    for (const c of this.coinPops) c.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    if (this.player) this.player.draw(ctx);
    ctx.restore();

    // Floating texts are already in screen space.
    for (const f of this.floatingTexts) f.draw(ctx);

    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawFlagCloth(ctx) {
    const x = this.world.flagCol * TILE - this.cam.x;
    const y = this.flagClothY;
    ctx.fillStyle = "#3aa14b";
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2 - 2, y + 4);
    ctx.lineTo(x + TILE / 2 - 24, y + 12);
    ctx.lineTo(x + TILE / 2 - 2, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + TILE / 2 - 12, y + 9, 5, 5);
  }

  emitHud() {
    this.hooks.onHud?.({
      score: this.score,
      coins: this.coins,
      world: LEVELS[this.levelIndex]?.name ?? "1-1",
      time: Math.ceil(this.timeLeft ?? 0),
      lives: Math.max(0, this.lives),
    });
  }

  // ---- loop --------------------------------------------------------------
  startLoop() {
    if (this._raf) return;
    this._last = performance.now();
    const tick = (now) => {
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.05) dt = 0.05; // clamp to avoid tunneling after stalls
      this.update(dt);
      this.render();
      this.input.flush();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
}
