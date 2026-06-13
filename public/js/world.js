// The tile world: stores the mutable tile grid and handles solidity queries
// and block-bump interactions (question blocks, breakable bricks, coins).

import { TILE, SOLID, QBLOCKS, T } from "./constants.js";
import { Mushroom, FireFlower, Star, Particle, FloatingText } from "./entities.js";

export class World {
  constructor(def) {
    this.def = def;
    this.tiles = def.tiles.map((row) => row.split(""));
    this.rows = this.tiles.length;
    this.cols = this.tiles[0].length;
    this.pixelWidth = this.cols * TILE;
    this.pixelHeight = this.rows * TILE;
    this.flagCol = def.flagCol;
    this.bumpAnims = new Map(); // "col,row" -> {t, dur}
  }

  tile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return T.EMPTY;
    return this.tiles[row][col];
  }

  setTile(col, row, ch) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    this.tiles[row][col] = ch;
  }

  isSolid(col, row) {
    if (col < 0) return true; // invisible left wall
    return SOLID.has(this.tile(col, row));
  }

  // Triggered when the player bumps a block from below.
  bumpBlock(col, row, player, game) {
    const ch = this.tile(col, row);
    if (ch === T.EMPTY) return;

    if (QBLOCKS.has(ch)) {
      this.setTile(col, row, T.USED);
      this._animateBump(col, row);
      if (ch === T.QBLOCK_COIN) {
        game.collectCoin(col * TILE + TILE / 2, row * TILE, 200);
        game.spawnCoinPop(col * TILE, row * TILE);
      } else if (ch === T.QBLOCK_MUSH) {
        // Mushroom when small, fire flower when already big/fire.
        if (player.isBig) {
          game.entities.push(new FireFlower(col * TILE + 3, row * TILE));
        } else {
          game.entities.push(new Mushroom(col * TILE + 3, row * TILE, false));
        }
        game.audio.powerup();
      } else if (ch === T.QBLOCK_STAR) {
        game.entities.push(new Star(col * TILE + 3, row * TILE));
        game.audio.powerup();
      } else if (ch === T.QBLOCK_1UP) {
        game.entities.push(new Mushroom(col * TILE + 3, row * TILE, true));
        game.audio.oneUp();
      }
      return;
    }

    if (ch === T.BRICK) {
      if (player.isBig) {
        this.setTile(col, row, T.EMPTY);
        game.audio.break_();
        game.addScore(50);
        this._spawnDebris(col, row, game);
      } else {
        this._animateBump(col, row);
        game.audio.bump();
      }
      return;
    }

    // Anything else solid: a dull bump.
    game.audio.bump();
  }

  _animateBump(col, row) {
    this.bumpAnims.set(`${col},${row}`, { t: 0, dur: 0.18 });
  }

  bumpOffset(col, row) {
    const a = this.bumpAnims.get(`${col},${row}`);
    if (!a) return 0;
    const p = a.t / a.dur;
    return -Math.sin(p * Math.PI) * 10; // pixels up
  }

  _spawnDebris(col, row, game) {
    const cx = col * TILE + TILE / 2;
    const cy = row * TILE + TILE / 2;
    const color = "#c0531c";
    const vels = [
      [-120, -360],
      [120, -360],
      [-90, -220],
      [90, -220],
    ];
    for (const [vx, vy] of vels) {
      game.particles.push(new Particle(cx, cy, vx, vy, color, 8, 1.1));
    }
  }

  update(dt) {
    for (const [key, a] of this.bumpAnims) {
      a.t += dt;
      if (a.t >= a.dur) this.bumpAnims.delete(key);
    }
  }
}
