// Centralized input state for keyboard and on-screen touch controls.

const KEY_MAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  KeyZ: "jump",
  KeyX: "run",
  ShiftLeft: "run",
  ShiftRight: "run",
  KeyC: "item",
  ArrowDown: "item",
  KeyS: "item",
  KeyP: "pause",
  KeyM: "mute",
  Enter: "start",
};

export class Input {
  constructor() {
    this.state = { left: false, right: false, jump: false, run: false, item: false };
    // Edge-triggered events consumed once per frame.
    this.pressed = new Set();
    // Set of actions held this frame (for on-screen key feedback).
    this.held = new Set();
    this._setup();
  }

  _setup() {
    window.addEventListener("keydown", (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      // Prevent page scroll on arrows/space.
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(action);
      this.held.add(action);
      if (action in this.state) this.state[action] = true;
    });

    window.addEventListener("keyup", (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      this.held.delete(action);
      if (action in this.state) this.state[action] = false;
    });

    // Lose all held keys when the tab loses focus (avoids "stuck running").
    window.addEventListener("blur", () => this.releaseAll());

    this._setupTouch();
  }

  _setupTouch() {
    const container = document.getElementById("touch-controls");
    if (!container) return;
    container.querySelectorAll(".tbtn").forEach((btn) => {
      const key = btn.dataset.key;
      const action = key === "jump" ? "jump" : key;
      const down = (e) => {
        e.preventDefault();
        this.pressed.add(action);
        this.held.add(action);
        if (action in this.state) this.state[action] = true;
      };
      const up = (e) => {
        e.preventDefault();
        this.held.delete(action);
        if (action in this.state) this.state[action] = false;
      };
      btn.addEventListener("touchstart", down, { passive: false });
      btn.addEventListener("touchend", up, { passive: false });
      btn.addEventListener("touchcancel", up, { passive: false });
      btn.addEventListener("mousedown", down);
      btn.addEventListener("mouseup", up);
      btn.addEventListener("mouseleave", up);
    });
  }

  releaseAll() {
    for (const k of Object.keys(this.state)) this.state[k] = false;
    this.held.clear();
  }

  // Consume an edge-triggered press (true only on the frame it was pressed).
  consume(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return true;
    }
    return false;
  }

  // Clear edge events at the end of a frame.
  flush() {
    this.pressed.clear();
  }
}
