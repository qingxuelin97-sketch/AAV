// Procedural audio: faithful chiptune rendition of the Super Mario Bros.
// overworld theme (melody + bass + light percussion) plus all the sound
// effects — every sound is synthesized, no audio files required.

// Convert a note name like "C4", "A#4", "Bb5" to a frequency in Hz.
function noteToFreq(name) {
  if (!name) return 0;
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) return 0;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const midi = base + acc + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---- Super Mario Bros. overworld theme (one step = one 16th note) ---------
// "_" is a rest / sustain gap. Transposed to a comfortable octave.
// prettier-ignore
const THEME_MELODY = [
  "E5","E5","_","E5", "_","C5","E5","_", "G5","_","_","_", "G4","_","_","_",
  "C5","_","_","G4", "_","_","E4","_", "_","A4","_","B4", "_","A#4","A4","_",
  "G4","E5","G5","A5", "_","F5","G5","_", "E5","_","C5","D5", "B4","_","_","_",
  "C5","_","_","G4", "_","_","E4","_", "_","A4","_","B4", "_","A#4","A4","_",
  "G4","E5","G5","A5", "_","F5","G5","_", "E5","_","C5","D5", "B4","_","_","_",
  // ---- B section ----
  "_","_","G5","F#5", "F5","D#5","_","E5", "_","G#4","A4","C5", "_","A4","C5","D5",
  "_","_","G5","F#5", "F5","D#5","_","E5", "_","C6","_","C6", "C6","_","_","_",
  "_","_","G5","F#5", "F5","D#5","_","E5", "_","G#4","A4","C5", "_","A4","C5","D5",
  "_","_","D#5","_", "_","D5","_","_", "C5","_","_","_", "_","_","_","_",
];
// prettier-ignore
const THEME_BASS = [
  "C3","_","C3","_", "G2","_","G2","_", "C3","_","C3","_", "G2","_","G2","_",
  "C3","_","C3","_", "G2","_","G2","_", "A2","_","A2","_", "E2","_","E2","_",
  "F2","_","F2","_", "C3","_","C3","_", "G2","_","G2","_", "G2","_","G2","_",
  "C3","_","C3","_", "G2","_","G2","_", "A2","_","A2","_", "E2","_","E2","_",
  "F2","_","F2","_", "C3","_","C3","_", "G2","_","G2","_", "G2","_","G2","_",
  "C3","_","C3","_", "C3","_","C3","_", "A2","_","A2","_", "F2","_","F2","_",
  "G2","_","G2","_", "G2","_","G2","_", "C3","_","C3","_", "C3","_","C3","_",
  "C3","_","C3","_", "C3","_","C3","_", "A2","_","A2","_", "F2","_","F2","_",
  "G2","_","G2","_", "G2","_","G2","_", "C3","_","C3","_", "C3","_","C3","_",
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._scheduler = null;
    this._step = 0;
    this._nextTime = 0;
    this._playing = false;
    this.fast = false; // sped-up theme during star power
    this.stepDur = 0.108;
  }

  _ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  }

  unlock() {
    this._ensure();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  // ---- generic one-shot tone (for SFX) ------------------------------------
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
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.2, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.sfxGain);
    src.start(t0);
  }

  // ---- sound effects ------------------------------------------------------
  jump() { this._tone(380, 0.18, "square", 0.25, 0, 760); }
  stomp() { this._tone(240, 0.1, "square", 0.3, 0, 90); }
  bump() { this._tone(180, 0.08, "square", 0.25, 0, 120); }
  break_() { this._noise(0.12, 0.25); this._tone(260, 0.08, "sawtooth", 0.2); }
  pipe() { this._tone(300, 0.3, "square", 0.25, 0, 80); }
  fireball() { this._tone(700, 0.12, "square", 0.2, 0, 220); }
  kick() { this._tone(420, 0.1, "square", 0.25, 0, 180); }

  coin() {
    this._tone(988, 0.07, "square", 0.3);
    this._tone(1319, 0.2, "square", 0.3, 0.07);
  }
  powerup() {
    [392, 523, 659, 784, 1047, 1319].forEach((n, i) =>
      this._tone(n, 0.12, "square", 0.25, i * 0.06)
    );
  }
  powerdown() {
    [659, 523, 415, 330].forEach((n, i) => this._tone(n, 0.12, "square", 0.25, i * 0.08));
  }
  oneUp() {
    [659, 784, 1047, 1319].forEach((n, i) => this._tone(n, 0.14, "triangle", 0.25, i * 0.1));
  }
  death() {
    this.stopTheme();
    const seq = [
      [659, 0], [659, 0.12], [659, 0.36], [523, 0.5], [659, 0.62],
      [784, 0.74], [392, 1.0],
    ];
    for (const [f, t] of seq) this._tone(f, 0.2, "square", 0.3, t);
  }
  flagpole() {
    // Descending arpeggio as Mario slides down the pole.
    const notes = [1047, 988, 880, 784, 698, 659, 587, 523, 440, 392];
    notes.forEach((n, i) => this._tone(n, 0.12, "square", 0.28, i * 0.07));
  }
  levelClear() {
    this.stopTheme();
    const seq = [
      [196, 0], [262, 0.13], [330, 0.26], [392, 0.39], [523, 0.52], [659, 0.65],
      [784, 0.78], [659, 1.0], [415, 1.2], [523, 1.33], [622, 1.46], [831, 1.6],
      [1047, 1.73],
    ];
    for (const [f, t] of seq) this._tone(f, 0.18, "square", 0.3, t);
  }
  gameOver() {
    this.stopTheme();
    const seq = [[392, 0], [330, 0.2], [262, 0.4], [196, 0.6], [262, 0.8], [196, 1.0], [165, 1.2]];
    for (const [f, t] of seq) this._tone(f, 0.25, "triangle", 0.3, t);
  }
  firework() { this._noise(0.25, 0.18); this._tone(180, 0.3, "sawtooth", 0.12, 0, 1200); }

  // ---- the looping theme --------------------------------------------------
  startTheme(fast = false) {
    this._ensure();
    if (!this.ctx) return;
    this.fast = fast;
    if (this._playing) return;
    this._playing = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.08;
    this._scheduler = setInterval(() => this._schedule(), 25);
  }

  setFast(fast) {
    this.fast = fast;
  }

  _schedule() {
    if (!this.ctx) return;
    const ahead = this.ctx.currentTime + 0.15;
    const dur = this.fast ? this.stepDur * 0.62 : this.stepDur;
    while (this._nextTime < ahead) {
      this._playStep(this._step, this._nextTime, dur);
      this._step = (this._step + 1) % THEME_MELODY.length;
      this._nextTime += dur;
    }
  }

  _playStep(i, when, dur) {
    if (this.muted) return;
    const mel = THEME_MELODY[i];
    if (mel && mel !== "_") this._voice(noteToFreq(mel), when, dur * 0.92, "square", 0.14, this.musicGain);
    const bass = THEME_BASS[i];
    if (bass && bass !== "_") this._voice(noteToFreq(bass), when, dur * 0.9, "triangle", 0.12, this.musicGain);
    // Light percussion: a soft kick on every beat.
    if (i % 4 === 0) this._kickAt(when);
  }

  _voice(freq, when, dur, type, vol, dest) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  _kickAt(when) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(50, when + 0.09);
    gain.gain.setValueAtTime(0.12, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.12);
  }

  stopTheme() {
    this._playing = false;
    if (this._scheduler) {
      clearInterval(this._scheduler);
      this._scheduler = null;
    }
  }

  // Back-compat aliases used elsewhere.
  startMusic() { this.startTheme(); }
  stopMusic() { this.stopTheme(); }
  flag() { this.flagpole(); }
  win() { this.levelClear(); }
}
