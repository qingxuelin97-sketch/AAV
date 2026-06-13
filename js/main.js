// Entry point: builds the game, wires overlays/buttons, syncs the HUD and talks
// to the leaderboard API.

import { Input } from "./input.js";
import { AudioEngine } from "./audio.js";
import { Game } from "./game.js";
import { STATE } from "./constants.js";
import { fetchLeaderboard, submitScore } from "./api.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const input = new Input();
const audio = new AudioEngine();

const overlays = {
  title: $("overlay-title"),
  pause: $("overlay-pause"),
  gameover: $("overlay-gameover"),
  win: $("overlay-win"),
};

function hideAllOverlays() {
  Object.values(overlays).forEach((o) => o.classList.add("hidden"));
}
function show(name) {
  hideAllOverlays();
  overlays[name].classList.remove("hidden");
}

// HUD elements.
const hud = {
  score: $("hud-score"),
  coins: $("hud-coins"),
  world: $("hud-world"),
  time: $("hud-time"),
  lives: $("hud-lives"),
  power: $("hud-power"),
};

const POWER_LABEL = { small: "小", big: "大", fire: "🌸" };

let lastStats = null;
let submittedId = null;

const game = new Game(canvas, input, audio, {
  onHud(s) {
    hud.score.textContent = String(s.score).padStart(6, "0");
    hud.coins.textContent = "×" + String(s.coins).padStart(2, "0");
    hud.world.textContent = s.world;
    hud.time.textContent = s.time;
    hud.lives.textContent = "×" + s.lives;
    hud.power.textContent = s.star ? "⭐" : POWER_LABEL[s.power] || "小";
  },
  onPause(paused) {
    if (paused) show("pause");
    else hideAllOverlays();
  },
  onGameOver(stats) {
    lastStats = stats;
    submittedId = null;
    $("go-score").textContent = stats.score.toLocaleString();
    resetSubmitUI($("btn-submit-score"), $("player-name"));
    show("gameover");
  },
  onWin(stats) {
    lastStats = stats;
    submittedId = null;
    $("win-score").textContent = stats.score.toLocaleString();
    resetSubmitUI($("btn-submit-score-win"), $("player-name-win"));
    show("win");
  },
});

function resetSubmitUI(btn, nameInput) {
  btn.disabled = false;
  btn.textContent = "SUBMIT SCORE";
  nameInput.disabled = false;
  const saved = localStorage.getItem("mario_name");
  if (saved) nameInput.value = saved;
}

// ---- Buttons --------------------------------------------------------------
$("btn-start").addEventListener("click", () => {
  audio.unlock();
  hideAllOverlays();
  game.start();
});

$("btn-resume").addEventListener("click", () => {
  if (game.state === STATE.PAUSED) {
    game.state = STATE.PLAYING;
    audio.startMusic();
    hideAllOverlays();
  }
});

$("btn-quit").addEventListener("click", () => {
  game.state = STATE.TITLE;
  audio.stopMusic();
  show("title");
  refreshLeaderboard();
});

$("btn-retry").addEventListener("click", () => {
  hideAllOverlays();
  game.start();
});
$("btn-retry-win").addEventListener("click", () => {
  hideAllOverlays();
  game.start();
});

async function doSubmit(btn, nameInput) {
  if (!lastStats || submittedId) return;
  const name = (nameInput.value || "ANON").trim();
  localStorage.setItem("mario_name", name);
  btn.disabled = true;
  btn.textContent = "SAVING…";
  nameInput.disabled = true;
  const res = await submitScore({ ...lastStats, name });
  if (res && res.entry) {
    submittedId = res.entry.id;
    btn.textContent = res.rank ? `SAVED · RANK #${res.rank}` : "SAVED!";
  } else {
    btn.textContent = "RETRY SAVE";
    btn.disabled = false;
    nameInput.disabled = false;
  }
  await refreshLeaderboard();
}

$("btn-submit-score").addEventListener("click", () => doSubmit($("btn-submit-score"), $("player-name")));
$("btn-submit-score-win").addEventListener("click", () =>
  doSubmit($("btn-submit-score-win"), $("player-name-win"))
);

$("btn-refresh-lb").addEventListener("click", () => refreshLeaderboard());

// ---- Leaderboard ----------------------------------------------------------
async function refreshLeaderboard() {
  const list = $("leaderboard");
  const entries = await fetchLeaderboard(10);
  if (!entries.length) {
    list.innerHTML = '<li class="empty">No scores yet — be the first!</li>';
    return;
  }
  list.innerHTML = entries
    .map((e, i) => {
      const you = e.id === submittedId ? " you" : "";
      const medal = ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
      return `<li class="${you.trim()}">
        <span class="rank">${medal}</span>
        <span class="nm">${escapeHtml(e.name)}</span>
        <span class="sc">${e.score.toLocaleString()}</span>
      </li>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Allow Enter to submit from the name fields.
["player-name", "player-name-win"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const btn = id === "player-name" ? $("btn-submit-score") : $("btn-submit-score-win");
      btn.click();
    }
  });
});

// ---- Boot -----------------------------------------------------------------
show("title");
refreshLeaderboard();
game.startLoop();
