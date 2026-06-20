// The Game orchestrates state, the world, entities, camera, scoring and the
// main loop. UI/overlay concerns live in main.js and are reached via hooks.

import { TILE, VIEW_W, VIEW_H, GRAVITY, STOMP_BOUNCE, T, STATE } from "./constants.js";
import { LEVELS } from "./levels.js";
import { World } from "./world.js";
import {
  Player,
  Goomba,
  Koopa,
  Spiny,
  Paratroopa,
  PiranhaPlant,
  Mushroom,
  FireFlower,
  IceFlower,
  SuperLeaf,
  BoomerangFlower,
  Star,
  Fireball,
  Boomerang,
  Bowser,
  BossFireball,
  Axe,
  Particle,
  FloatingText,
} from "./entities.js";
import { drawBackground, drawWorld, drawCastle, drawFirework } from "./render.js";
import { drawCoin, drawShadow } from "./sprites.js";

const SLIDE_SPEED = 240;
const WALK_OFF_SPEED = 95;
const COINS_FOR_1UP = 100;
const FIREWORK_COLORS = ["#ff5a5f", "#ffd23f", "#5fe06b", "#5aa9ff", "#ff8af0"];

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

// Which looping theme suits each background.
const MUSIC_FOR_BG = { day: "overworld", dusk: "overworld", night: "night", snow: "snow", cave: "night", castle: "boss" };

const BOSS_PRESETS = {
  mini: { variant: "mini", name: "锤子龟王", tint: "#4aa3ff", hp: 4, phases: 1, speed: 95 },
  fortress: { variant: "bowser", name: "暗影库巴", tint: "#8a3fd0", hp: 6, phases: 1, speed: 110 },
  bowser: { variant: "bowser", name: "库巴", hp: 5, phases: 3, speed: 95 },
};

const ENEMY = (e) =>
  e instanceof Goomba || e instanceof Koopa || e instanceof Spiny || e instanceof Paratroopa;
const ITEM = (e) =>
  e instanceof Mushroom ||
  e instanceof FireFlower ||
  e instanceof IceFlower ||
  e instanceof SuperLeaf ||
  e instanceof BoomerangFlower ||
  e instanceof Star;

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
    this._carryPower = "small";
    this.reserve = "mushroom";
    this.elapsedMs = 0;
    this.toast = null;
  }

  // A short banner explaining what just happened (e.g. an item's effect).
  showToast(text) {
    this.toast = { text, t: 2.4 };
  }

  // Deploy the reserved power-up as a collectible the player can grab.
  useReserve() {
    if (!this.reserve || !this.player?.alive) return;
    const x = this.player.cx - 13;
    const y = this.player.y - TILE;
    if (this.reserve === "fire") this.entities.push(new FireFlower(x, y));
    else if (this.reserve === "ice") this.entities.push(new IceFlower(x, y));
    else if (this.reserve === "leaf") this.entities.push(new SuperLeaf(x, y));
    else if (this.reserve === "boomerang") this.entities.push(new BoomerangFlower(x, y));
    else this.entities.push(new Mushroom(x, y, false));
    this.reserve = null;
    this.audio.pipe();
    this.showToast("已放出道具，去捡起来！");
  }

  // ---- lifecycle ---------------------------------------------------------
  start() {
    this.startAt(0);
  }

  // Begin a run from a chosen level (used by the level-select menu).
  startAt(index) {
    this.reset();
    this.audio.unlock();
    this.loadLevel(index);
    this.state = STATE.PLAYING;
    this.playTheme();
    this.emitHud();
  }

  // Start the correct looping theme for the current level (boss or overworld).
  playTheme() {
    this.audio.startTheme(this.themeName || "overworld", (this.player?.starTime ?? 0) > 0);
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.world = new World(def);
    this.timeLeft = def.time;
    this.themeName = def.boss ? "boss" : MUSIC_FOR_BG[def.bg] || "overworld";
    this.boss = null;
    this.bossDefeated = false;
    this.audio.setFast(false);

    // Extract spawn markers into entities; coins remain as tiles.
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
        } else if (ch === T.SPINY) {
          this.entities.push(new Spiny(col, row));
          this.world.setTile(col, row, T.EMPTY);
        } else if (ch === T.PARATROOPA) {
          this.entities.push(new Paratroopa(col, row));
          this.world.setTile(col, row, T.EMPTY);
        } else if (ch === T.PIRANHA) {
          this.entities.push(new PiranhaPlant(col, row + 1));
          this.world.setTile(col, row, T.EMPTY);
        } else if (ch === T.BOSS) {
          const preset = BOSS_PRESETS[def.bossType] || BOSS_PRESETS.bowser;
          this.boss = new Bowser(col, row, preset);
          this.entities.push(this.boss);
          this.world.setTile(col, row, T.EMPTY);
        } else if (ch === T.AXE) {
          this.entities.push(new Axe(col, row));
          this.world.setTile(col, row, T.EMPTY);
        }
      }
    }

    this.fireballs = [];
    this.boomerangs = [];
    this.bossFireballs = [];
    this.particles = [];
    this.floatingTexts = [];
    this.coinPops = [];
    this.fireworks = [];

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
    if (this._carryPower && this._carryPower !== "small") this.player.setPower(this._carryPower);

    // Every level starts with a Mushroom in the reserve box (press C to deploy).
    this.reserve = this.reserve || "mushroom";

    this.cam.x = 0;
    this.clearPhase = null;
    this.flagClothY = 3 * TILE;
    this.hooks.onPause?.(false);
  }

  restartLevel() {
    this._carryPower = "small"; // lose power on death
    this.loadLevel(this.levelIndex);
    this.state = STATE.PLAYING;
    this.playTheme();
    this.emitHud();
  }

  nextLevel() {
    this._carryPower = this.player.power;
    this.hooks.onLevelComplete?.(this.levelIndex);
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.win();
    } else {
      this.loadLevel(this.levelIndex + 1);
      this.state = STATE.PLAYING;
      this.playTheme();
      this.emitHud();
    }
  }

  win() {
    this.state = STATE.WIN;
    this.audio.stopTheme();
    this.audio.levelClear();
    this.hooks.onLevelComplete?.(this.levelIndex);
    this.hooks.onWin?.(this.stats());
  }

  gameOver() {
    this.state = STATE.GAMEOVER;
    this.audio.stopTheme();
    this.audio.gameOver();
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

  onStarEnd() {
    this.audio.setFast(false);
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

  spawnFireball(player) {
    if (this.fireballs.length >= 2) return false;
    const dir = player.facing;
    const x = dir > 0 ? player.x + player.w : player.x - 14;
    const y = player.y + player.h * 0.4;
    const type = player.power === "ice" ? "ice" : "fire";
    this.fireballs.push(new Fireball(x, y, dir, type));
    if (type === "ice") this.audio.iceball();
    else this.audio.fireball();
    return true;
  }

  // Throw a single boomerang (only one in flight at a time, like the games).
  spawnBoomerang(player) {
    if (this.boomerangs.some((b) => !b.dead)) return false;
    const dir = player.facing;
    const x = dir > 0 ? player.x + player.w - 6 : player.x - 8;
    const y = player.y + player.h * 0.35;
    this.boomerangs.push(new Boomerang(x, y, dir, player));
    this.audio.fireball();
    return true;
  }

  // Tail-spin attack: flip nearby enemies, bump/break adjacent blocks, and
  // chip the boss if it's right next to you. Uses a short hitbox in front.
  tailSpin(player) {
    const reach = 16;
    const box = {
      x: player.x - reach,
      y: player.y,
      w: player.w + reach * 2,
      h: player.h,
    };
    const hit = (e) =>
      box.x < e.x + e.w && box.x + box.w > e.x && box.y < e.y + e.h && box.y + box.h > e.y;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (ENEMY(e) && e.state !== "flipped" && e.state !== "frozen" && hit(e)) {
        if (e instanceof Spiny) continue; // spikes resist a tail whip
        const dir = e.cx < player.cx ? -1 : 1;
        e.flip(dir, this);
        this.addScore(200);
        this.popText(e.cx, e.y, "200", "#ffd23f");
      } else if (e.kind === "piranha" && e.active && hit(e)) {
        e.dead = true;
        this.addScore(200);
        this.popText(e.cx, e.y, "200", "#ffd23f");
      }
    }
    // Whack a brick directly beside Mario when big.
    const side = player.facing > 0 ? player.x + player.w + 2 : player.x - 2;
    const col = Math.floor(side / TILE);
    const row = Math.floor((player.y + player.h * 0.4) / TILE);
    if (this.world.tile(col, row) === T.BRICK && player.isBig) {
      this.world.setTile(col, row, T.EMPTY);
      this.audio.break_();
      this.addScore(50);
      this.world._spawnDebris(col, row, this);
    }
    // Right next to the boss? A small chip of damage.
    if (this.boss && this.boss.state === "alive" && hit(this.boss)) {
      if (this.boss.hit(this) && this.boss.state === "dead") this.defeatBoss();
    }
  }

  _bossDir(boss, player) {
    return player ? Math.sign(player.cx - boss.cx) || -1 : boss.facing;
  }

  // A quick stream of straight fireballs.
  bossBreathe(boss, player) {
    const dir = this._bossDir(boss, player);
    const x = dir < 0 ? boss.x - 10 : boss.x + boss.w - 10;
    const y = boss.y + 26;
    for (let i = 0; i < 3; i++) {
      this.bossFireballs.push(new BossFireball(x + dir * i * 8, y, dir * (280 + i * 30), -40, "fire"));
    }
    this.audio.bossFire();
  }

  // A fan of three fireballs.
  bossSpread(boss, player) {
    const dir = this._bossDir(boss, player);
    const x = dir < 0 ? boss.x - 10 : boss.x + boss.w - 10;
    const y = boss.y + 26;
    for (const vy of [-200, -60, 80]) {
      this.bossFireballs.push(new BossFireball(x, y, dir * 300, vy, "fire"));
    }
    this.audio.bossFire();
  }

  // Lobbed hammers (mini-boss).
  bossHammers(boss, player) {
    const dir = this._bossDir(boss, player);
    const x = dir < 0 ? boss.x - 6 : boss.x + boss.w - 6;
    const y = boss.y + 8;
    const n = boss.phase >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.bossFireballs.push(new BossFireball(x, y, dir * (150 + i * 80), -360 - i * 30, "hammer"));
    }
    this.audio.bump();
  }

  // Final-phase fury: a curtain of fireballs raining down around the player.
  bossRain(boss, player) {
    const cx = player ? player.cx : boss.cx;
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * 70 + (Math.random() * 30 - 15);
      this.bossFireballs.push(new BossFireball(x, 8, (Math.random() * 60 - 30), 220, "fire"));
    }
    this.audio.bossFire();
    this.addShake(4);
  }

  // Two ground shockwaves travelling outward from a landing slam.
  bossShock(boss) {
    const y = boss.y + boss.h - 24;
    this.bossFireballs.push(new BossFireball(boss.x, y, -330, 0, "shock"));
    this.bossFireballs.push(new BossFireball(boss.x + boss.w - 22, y, 330, 0, "shock"));
    this.audio.bossHit();
    this.addShake(7);
    this.spawnDust(boss.cx, boss.y + boss.h, 10);
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
    this.player.starTime = 0;
    this.player.vy = -560;
    this.audio.stopTheme();
    this.audio.setFast(false);
    this.audio.death();
    this.emitHud();
  }

  // ---- main update -------------------------------------------------------
  update(dt) {
    this.time += dt;

    if (this.input.consume("mute")) {
      const muted = this.audio.toggleMute();
      this.hooks.onMute?.(muted);
    }
    if (this.input.consume("pause")) {
      if (this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED;
        this.audio.stopTheme();
        this.hooks.onPause?.(true);
      } else if (this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING;
        this.playTheme();
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

    this.timeLeft -= dt * 2;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.killPlayer();
      return;
    }

    if (this.input.consume("item")) this.useReserve();

    const world = this.world;
    this.player.update(dt, this.input, world, this);
    world.update(dt);

    this.collectCoinTiles();

    // Update entities within an activation window around the camera.
    const lo = this.cam.x - 96;
    const hi = this.cam.x + VIEW_W + 96;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.kind === "boss") {
        e.update(dt, world, this.player, this);
        continue;
      }
      if (e.x + e.w < lo || e.x > hi) continue;
      if (e.contactCooldown > 0) e.contactCooldown -= dt;
      if (e.kind === "piranha") e.update(dt, world, this.player);
      else e.update(dt, world);
    }

    for (const fb of this.fireballs) fb.update(dt, world);
    for (const bm of this.boomerangs) bm.update(dt, world);
    for (const bf of this.bossFireballs) bf.update(dt, world);

    this.handleEnemyCollisions();
    this.handleShellCollisions();
    this.handleFireballCollisions();
    this.handleBoomerangCollisions();
    this.handlePiranhaCollisions();
    this.handleItemCollisions();
    this.handleBossCollisions();

    for (const p of this.particles) p.update(dt);
    for (const f of this.floatingTexts) f.update(dt);
    for (const c of this.coinPops) c.update(dt);
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }

    this.entities = this.entities.filter((e) => !e.dead);
    this.fireballs = this.fireballs.filter((f) => !f.dead);
    this.boomerangs = this.boomerangs.filter((b) => !b.dead);
    this.bossFireballs = this.bossFireballs.filter((f) => !f.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.floatingTexts = this.floatingTexts.filter((f) => !f.dead);
    this.coinPops = this.coinPops.filter((c) => !c.dead);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 36);
    this.updateCamera(dt);

    if (this.player.cx >= world.flagCol * TILE) this.startFlag();

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
    const star = p.starTime > 0;
    for (const e of this.entities) {
      if (e.dead || !ENEMY(e)) continue;
      if (e.state === "squashed" || e.state === "flipped") continue;
      if (!p.intersects(e)) continue;

      // A frozen enemy shatters into coins on contact and never hurts you.
      if (e.state === "frozen") {
        e.dead = true;
        this.collectCoin(e.cx, e.y, 200, false);
        this.spawnCoinPop(e.cx - TILE / 2, e.y);
        this.spawnBurst(e.cx, e.cy, "#cdeeff");
        continue;
      }

      // Star power: blast through everything.
      if (star) {
        e.flip(p.facing, this);
        this.addScore(200);
        this.popText(e.cx, e.y, "200", "#ffd23f");
        continue;
      }

      const pBottom = p.y + p.h;
      const stomp = p.vy > 0 && pBottom - e.y < e.h * 0.7;

      if (e instanceof Paratroopa) {
        // Stomp shears the wings → it drops as a walking Koopa you can finish.
        if (stomp) {
          this.entities.push(e.deWing());
          p.vy = STOMP_BOUNCE;
          this.addScore(100);
          this.popText(e.cx, e.y, "100");
        } else {
          p.damage(this);
        }
      } else if (e instanceof Spiny) {
        // Spiked back: jumping on it hurts. Bounce off a little if stomped so
        // you aren't glued to the spikes, then take the hit.
        if (stomp) p.vy = STOMP_BOUNCE * 0.5;
        p.damage(this);
      } else if (e instanceof Goomba) {
        if (stomp) {
          e.squash(this);
          p.vy = STOMP_BOUNCE;
          this.addScore(100);
          this.popText(e.cx, e.y, "100");
        } else {
          p.damage(this);
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
          const dir = p.cx < e.cx ? 1 : -1;
          e.kick(dir, this);
          e.contactCooldown = 0.2;
          if (stomp) p.vy = STOMP_BOUNCE;
          this.addScore(400);
          this.popText(e.cx, e.y, "400", "#ffd23f");
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

  handleShellCollisions() {
    for (const shell of this.entities) {
      if (shell.dead || !(shell instanceof Koopa) || shell.state !== "spin") continue;
      for (const e of this.entities) {
        if (e === shell || e.dead || !ENEMY(e)) continue;
        if (e.state === "squashed" || e.state === "flipped") continue;
        if (shell.intersects(e)) {
          e.flip(shell.vx > 0 ? 1 : -1, this);
          this.addScore(200);
          this.popText(e.cx, e.y, "200");
        }
      }
    }
  }

  handleFireballCollisions() {
    for (const fb of this.fireballs) {
      if (fb.dead) continue;
      const burst = fb.type === "ice" ? "#cdeeff" : "#ff8a3a";

      // Fire damages the boss; ice freezes it in place (a control tool).
      if (this.boss && this.boss.state === "alive" && fb.intersects(this.boss)) {
        if (fb.type === "ice") {
          this.boss.stun(this);
          this.popText(this.boss.cx, this.boss.y, "冻住!", "#aee4ff");
        } else if (this.boss.hit(this)) {
          this.popText(this.boss.cx, this.boss.y, "HIT!", "#ff5a5f");
          if (this.boss.state === "dead") this.defeatBoss();
        }
        fb.dead = true;
        this.spawnBurst(fb.cx, fb.cy, burst);
        continue;
      }

      for (const e of this.entities) {
        if (e.dead) continue;
        if (ENEMY(e) && e.state !== "squashed" && e.state !== "flipped" && e.state !== "frozen" && fb.intersects(e)) {
          if (fb.type === "ice") {
            e.freeze(this);
            this.popText(e.cx, e.y, "FREEZE", "#aee4ff");
          } else {
            e.flip(fb.vx > 0 ? 1 : -1, this);
            this.addScore(100);
            this.popText(e.cx, e.y, "100");
          }
          fb.dead = true;
          this.spawnBurst(fb.cx, fb.cy, burst);
          break;
        }
        if (e.kind === "piranha" && e.active && fb.intersects(e)) {
          e.dead = true;
          fb.dead = true;
          this.addScore(200);
          this.popText(e.cx, e.y, "200", "#ffd23f");
          this.spawnBurst(fb.cx, fb.cy, burst);
          break;
        }
      }
    }
  }

  // Boomerangs flip enemies (both on the way out and back) and chip the boss,
  // but pass through rather than popping, so one throw can hit several foes.
  handleBoomerangCollisions() {
    for (const bm of this.boomerangs) {
      if (bm.dead) continue;
      if (this.boss && this.boss.state === "alive" && bm.intersects(this.boss)) {
        if (!(this.boss.invuln > 0) && this.boss.hit(this)) {
          this.popText(this.boss.cx, this.boss.y, "HIT!", "#ff5a5f");
          if (this.boss.state === "dead") this.defeatBoss();
        }
      }
      for (const e of this.entities) {
        if (e.dead) continue;
        if (
          ENEMY(e) &&
          e.state !== "squashed" &&
          e.state !== "flipped" &&
          e.state !== "frozen" &&
          bm.intersects(e)
        ) {
          if (e instanceof Spiny) continue; // spikes shrug off a boomerang
          e.flip(bm.vx > 0 ? 1 : -1, this);
          this.addScore(100);
          this.popText(e.cx, e.y, "100");
        } else if (e.kind === "piranha" && e.active && bm.intersects(e)) {
          e.dead = true;
          this.addScore(200);
          this.popText(e.cx, e.y, "200", "#ffd23f");
        }
      }
    }
  }

  // Player vs boss, boss fire vs player, and the bridge axe.
  handleBossCollisions() {
    const p = this.player;
    if (!p.alive) return;

    // Boss fire breath hurts the player.
    for (const bf of this.bossFireballs) {
      if (!bf.dead && p.intersects(bf)) {
        bf.dead = true;
        p.damage(this);
      }
    }

    // Touching the axe defeats the boss instantly (classic bridge collapse).
    for (const e of this.entities) {
      if (e.kind === "axe" && !e.dead && p.intersects(e)) {
        e.dead = true;
        if (this.boss && this.boss.state === "alive") {
          this.boss.state = "dead";
          this.boss.vy = -220;
        }
        this.defeatBoss();
        return;
      }
    }

    // Body contact with a living boss.
    const boss = this.boss;
    if (boss && boss.state === "alive" && p.intersects(boss)) {
      if (p.starTime > 0) {
        if (boss.hit(this) && boss.state === "dead") this.defeatBoss();
      } else {
        p.damage(this); // Bowser is spiky — stomping doesn't work
      }
    }
  }

  defeatBoss() {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.addScore(5000);
    this.popText((this.boss?.cx ?? this.player.cx), (this.boss?.y ?? this.player.y) - 10, "5000", "#ffd23f");
    this.audio.bossDefeat();
    this.bossFireballs = [];
    this.player.controllable = false;
    this.player.vx = 0;
    // Celebrate, then win (boss level is the finale).
    this.state = STATE.LEVEL_CLEAR;
    this.clearPhase = "celebrate";
    this.clearTimer = 0;
    this._fireworkTimer = 0;
    this.fireworks = [];
  }

  handlePiranhaCollisions() {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.entities) {
      if (e.dead || e.kind !== "piranha" || !e.active) continue;
      if (!p.intersects(e)) continue;
      if (p.starTime > 0) {
        e.dead = true;
        this.addScore(200);
        this.popText(e.cx, e.y, "200", "#ffd23f");
      } else {
        p.damage(this);
      }
    }
  }

  // Power-up forms a flower/leaf grants, with a colour + tooltip. Picking up a
  // form you already have stashes a spare in the reserve box instead.
  static POWERUPS = {
    fire: { color: "#ff8a3a", toast: "🌸 火焰：按 X 发射火球，是 Boss 的主要输出" },
    ice: { color: "#7ec8ff", toast: "🧊 冰冻：按 X 冻住敌人(碎裂得金币)，可冻僵 Boss" },
    tail: { color: "#e0902f", toast: "🍃 狸猫：跳跃中按住跳=滑翔，按 X 用尾巴扫飞敌人" },
    boomerang: { color: "#9fb6ff", toast: "🪃 回旋镖：按 X 投掷，去回都能击中敌人，克制 Boss" },
  };

  // Grant a flower/leaf form (or stash a spare if already held).
  applyPowerup(type, e) {
    const p = this.player;
    const cfg = Game.POWERUPS[type];
    if (p.power === type && !this.reserve) this.reserve = type; // stash spare
    p.setPower(type);
    this.audio.powerup();
    this.addScore(1000);
    this.popText(e.cx, e.y, "1000", cfg.color);
    this.showToast(cfg.toast);
  }

  handleItemCollisions() {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.entities) {
      if (e.dead || !ITEM(e)) continue;
      if (!p.intersects(e)) continue;
      e.dead = true;
      if (e instanceof Mushroom && e.oneUp) {
        this.lives++;
        this.audio.oneUp();
        this.popText(e.cx, e.y, "1UP", "#5fe06b");
        this.showToast("🍄 1UP：生命 +1");
      } else if (e instanceof Mushroom) {
        if (p.power === "small") {
          p.setPower("big");
          this.showToast("🍄 变大：可挨一次伤害，能顶碎砖块");
        } else if (!this.reserve) {
          this.reserve = "mushroom"; // stash spare
          this.showToast("🍄 已存入道具栏（按 C 使用）");
        }
        this.audio.powerup();
        this.addScore(1000);
        this.popText(e.cx, e.y, "1000", "#fff");
      } else if (e instanceof FireFlower) {
        this.applyPowerup("fire", e);
      } else if (e instanceof IceFlower) {
        this.applyPowerup("ice", e);
      } else if (e instanceof SuperLeaf) {
        this.applyPowerup("tail", e);
      } else if (e instanceof BoomerangFlower) {
        this.applyPowerup("boomerang", e);
      } else if (e instanceof Star) {
        p.giveStar();
        this.audio.setFast(true);
        this.audio.powerup();
        this.addScore(1000);
        this.popText(e.cx, e.y, "STAR!", "#ffd23f");
        this.showToast("⭐ 无敌星：短时间无敌，撞飞一切，还能撞伤 Boss");
      }
    }
  }

  spawnBurst(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.particles.push(
        new Particle(x, y, Math.cos(a) * 120, Math.sin(a) * 120, color, 5, 0.4, 0.2)
      );
    }
  }

  // Soft dust puffs for landings and running (game-feel feedback).
  spawnDust(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      this.particles.push(
        new Particle(
          x + (Math.random() * 10 - 5),
          y - 3,
          Math.random() * 90 - 45,
          -Math.random() * 70,
          "rgba(225,222,210,0.9)",
          3 + Math.random() * 3,
          0.4,
          0.12
        )
      );
    }
  }

  addShake(mag) {
    this.shake = Math.min(9, Math.max(this.shake || 0, mag));
  }

  // Smoothly follow the player with a little look-ahead in the direction of travel.
  updateCamera(dt = 1 / 60) {
    const look = this.player.facing * 28 + this.player.vx * 0.12;
    const max = this.world.pixelWidth - VIEW_W;
    const target = Math.max(0, Math.min(max, this.player.cx - VIEW_W * 0.42 + look));
    const k = Math.min(1, dt * 9);
    this.cam.x += (target - this.cam.x) * k;
    this.cam.x = Math.max(0, Math.min(max, this.cam.x));
  }

  // ---- death animation ---------------------------------------------------
  updateDying(dt) {
    this.deathTimer += dt;
    const p = this.player;
    if (this.deathTimer > 0.4) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.floatingTexts) f.update(dt);
    this.floatingTexts = this.floatingTexts.filter((f) => !f.dead);

    if (this.deathTimer > 2.4) {
      this.lives--;
      if (this.lives < 0) this.gameOver();
      else this.restartLevel();
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
    this.audio.stopTheme();
    this.audio.setFast(false);
    this.audio.flagpole();

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
      p.walkFrame = 0;
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
      p.walkTimer += WALK_OFF_SPEED * dt;
      p.walkFrame = Math.floor(p.walkTimer / 18) % 2 === 0 ? 1 : 2;
      this.updateCamera(dt);
      if (p.x > (this.world.flagCol + 6) * TILE) {
        const timeBonus = Math.floor(this.timeLeft) * 50;
        this.addScore(timeBonus);
        this.popText(p.cx + 40, p.y - 10, "TIME×50 = " + timeBonus, "#fff");
        this.audio.levelClear();
        this.clearPhase = "celebrate";
        this.clearTimer = 0;
        this._fireworkTimer = 0;
      }
    } else if (this.clearPhase === "celebrate") {
      this.clearTimer += dt;
      this._fireworkTimer -= dt;
      if (this._fireworkTimer <= 0) {
        this._fireworkTimer = 0.35;
        this.fireworks.push({
          x: 120 + Math.random() * (VIEW_W - 240),
          y: 60 + Math.random() * 160,
          t: 0,
          color: FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0],
        });
        this.audio.firework();
      }
      for (const fw of this.fireworks) fw.t += dt * 1.2;
      this.fireworks = this.fireworks.filter((fw) => fw.t < 1);
      if (this.clearTimer > 2.6) this.nextLevel();
    }
    this.emitHud();
  }

  // ---- rendering ---------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.state === STATE.TITLE) {
      drawBackground(ctx, this.cam, LEVELS[0], this.time);
      return;
    }

    const def = LEVELS[this.levelIndex];

    // Screen shake: offset the whole gameplay layer (HUD stays put).
    const sh = this.shake || 0;
    const ox = sh ? (Math.random() * 2 - 1) * sh : 0;
    const oy = sh ? (Math.random() * 2 - 1) * sh : 0;
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));

    drawBackground(ctx, this.cam, def, this.time);

    const castleX = (this.world.flagCol + 8) * TILE - this.cam.x;
    if (castleX < VIEW_W + 200 && castleX > -300) {
      drawCastle(ctx, castleX, (this.world.rows - 2) * TILE);
    }

    drawWorld(ctx, this.world, this.cam, this.time);
    this.drawFlagCloth(ctx);

    ctx.save();
    ctx.translate(-this.cam.x, 0);
    // Ground shadows under grounded characters for depth.
    for (const e of this.entities) {
      if (e.onGround && (ENEMY(e) || e.kind === "boss")) drawShadow(ctx, e.cx, e.y + e.h, e.w);
    }
    if (this.player && this.player.onGround && this.player.alive) {
      drawShadow(ctx, this.player.cx, this.player.y + this.player.h, this.player.w);
    }
    for (const e of this.entities) e.draw(ctx);
    for (const fb of this.fireballs) fb.draw(ctx);
    for (const bm of this.boomerangs) bm.draw(ctx);
    for (const bf of this.bossFireballs) bf.draw(ctx);
    for (const c of this.coinPops) c.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    if (this.player) this.player.draw(ctx);
    ctx.restore();

    for (const f of this.floatingTexts) f.draw(ctx);

    // Fireworks are drawn in screen space during the celebration.
    if (this.fireworks) {
      for (const fw of this.fireworks) drawFirework(ctx, fw.x, fw.y, fw.t, fw.color);
    }

    ctx.restore(); // end shake layer

    if (this.boss && this.boss.state === "alive") this.drawBossBar(ctx);
    if (this.toast) this.drawToast(ctx);

    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawToast(ctx) {
    const a = Math.min(1, this.toast.t) * Math.min(1, (2.4 - this.toast.t) * 4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    const text = this.toast.text;
    const tw = ctx.measureText(text).width;
    const y = VIEW_H - 70;
    ctx.fillStyle = "rgba(8,4,24,0.85)";
    ctx.fillRect(VIEW_W / 2 - tw / 2 - 16, y - 20, tw + 32, 32);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW_W / 2 - tw / 2 - 16, y - 20, tw + 32, 32);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, VIEW_W / 2, y);
    ctx.restore();
  }

  drawBossBar(ctx) {
    const boss = this.boss;
    const w = 300;
    const x = (VIEW_W - w) / 2;
    const y = 16;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 10, y - 6, w + 20, 38);
    ctx.fillStyle = boss.enraged ? "#ff6a6a" : "#fff";
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    const phaseTag = boss.maxPhase > 1 ? `  [${boss.phase}/${boss.maxPhase}]` : "";
    ctx.fillText(boss.name + phaseTag, VIEW_W / 2, y + 6);
    const hpMax = boss.hpPerPhase;
    const pw = w / hpMax;
    for (let i = 0; i < hpMax; i++) {
      ctx.fillStyle = i < boss.hp ? (boss.enraged ? "#ff7a2a" : "#ff3b3b") : "#3a2030";
      ctx.fillRect(x + i * pw + 2, y + 14, pw - 4, 10);
    }
    ctx.restore();
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
      power: this.player?.power ?? "small",
      star: (this.player?.starTime ?? 0) > 0,
      reserve: this.reserve ?? null,
    });
  }

  // ---- loop --------------------------------------------------------------
  startLoop() {
    if (this._raf) return;
    this._last = performance.now();
    const tick = (now) => {
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.05) dt = 0.05;
      this.update(dt);
      this.render();
      this.input.flush();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
}
