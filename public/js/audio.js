// Procedural sound effects + a simple looping background tune using the Web
// Audio API, so the game ships with zero binary audio assets.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.musicGain = null;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  _ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
  }

  // Browsers require resume() after a user gesture.
  unlock() {
    this._ensure();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 0.6;
    }
    return this.muted;
  }

  _tone(freq, dur, type = "square", vol = 0.3, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  jump() {
    this._tone(420, 0.16, "square", 0.25, 0, 720);
  }

  stomp() {
    this._tone(240, 0.1, "square", 0.3, 0, 90);
  }

  coin() {
    this._tone(988, 0.07, "square", 0.3);
    this._tone(1319, 0.18, "square", 0.3, 0.07);
  }

  powerup() {
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((n, i) => this._tone(n, 0.12, "square", 0.25, i * 0.08));
  }

  bump() {
    this._tone(160, 0.08, "square", 0.25, 0, 120);
  }

  break_() {
    this._tone(300, 0.06, "sawtooth", 0.25);
    this._tone(200, 0.08, "sawtooth", 0.2, 0.04);
  }

  pipe() {
    this._tone(300, 0.3, "square", 0.25, 0, 80);
  }

  death() {
    const seq = [659, 622, 587, 392, 330, 262];
    seq.forEach((n, i) => this._tone(n, 0.18, "square", 0.3, i * 0.13));
  }

  oneUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this._tone(n, 0.12, "triangle", 0.25, i * 0.09));
  }

  flag() {
    const seq = [392, 523, 659, 784, 1047, 784, 1047];
    seq.forEach((n, i) => this._tone(n, 0.16, "square", 0.28, i * 0.12));
  }

  win() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1047, 1568];
    seq.forEach((n, i) => this._tone(n, 0.2, "square", 0.3, i * 0.18));
  }

  // ---- Looping background music --------------------------------------------
  // A short, public-domain-style cheerful bassline + melody loop.
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    // Melody (Hz) and bass patterns; 0 = rest.
    const melody = [
      659, 659, 0, 659, 0, 523, 659, 0, 784, 0, 0, 0, 392, 0, 0, 0,
      523, 0, 0, 392, 0, 0, 330, 0, 0, 440, 0, 494, 0, 466, 440, 0,
    ];
    const bass = [
      131, 0, 131, 0, 196, 0, 98, 0, 131, 0, 131, 0, 196, 0, 98, 0,
      165, 0, 165, 0, 196, 0, 98, 0, 131, 0, 131, 0, 98, 0, 98, 0,
    ];
    const stepDur = 0.16;
    this._musicStep = 0;
    const tick = () => {
      const i = this._musicStep % melody.length;
      const m = melody[i];
      const b = bass[i];
      if (m && !this.muted && this.ctx) this._musicNote(m, stepDur * 0.9, "square", 0.06);
      if (b && !this.muted && this.ctx) this._musicNote(b, stepDur * 0.9, "triangle", 0.08);
      this._musicStep++;
    };
    tick();
    this._musicTimer = setInterval(tick, stepDur * 1000);
  }

  _musicNote(freq, dur, type, vol) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }
}
