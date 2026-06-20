// Entry point: builds the game, wires overlays/buttons, the level-select menu,
// on-screen key feedback, syncs the HUD and talks to the leaderboard API.

import { Input } from "./input.js";
import { AudioEngine } from "./audio.js";
import { Game } from "./game.js";
import { STATE } from "./constants.js";
import { LEVELS } from "./levels.js";
import { fetchLeaderboard, submitScore } from "./api.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const input = new Input();
const audio = new AudioEngine();

const overlays = {
  title: $("overlay-title"),
  select: $("overlay-select"),
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

const hud = {
  score: $("hud-score"),
  coins: $("hud-coins"),
  world: $("hud-world"),
  time: $("hud-time"),
  lives: $("hud-lives"),
  power: $("hud-power"),
  reserve: $("hud-reserve"),
};

const POWER_LABEL = { small: "小", big: "大", fire: "🌸", ice: "🧊", tail: "🍃", boomerang: "🪃" };
const RESERVE_LABEL = { mushroom: "🍄", fire: "🌸", ice: "🧊", leaf: "🍃", boomerang: "🪃" };

let lastStats = null;
let submittedId = null;

// ---- Progress (unlocked levels) ------------------------------------------
function getUnlocked() {
  return Math.max(0, parseInt(localStorage.getItem("mario_progress") || "0", 10) || 0);
}
function setUnlocked(n) {
  localStorage.setItem("mario_progress", String(Math.max(getUnlocked(), n)));
}

const game = new Game(canvas, input, audio, {
  onHud(s) {
    hud.score.textContent = String(s.score).padStart(6, "0");
    hud.coins.textContent = "×" + String(s.coins).padStart(2, "0");
    hud.world.textContent = s.world;
    hud.time.textContent = s.time;
    hud.lives.textContent = "×" + s.lives;
    hud.power.textContent = s.star ? "⭐" : POWER_LABEL[s.power] || "小";
    hud.reserve.textContent = s.reserve ? RESERVE_LABEL[s.reserve] || "🍄" : "—";
  },
  onPause(paused) {
    if (paused) show("pause");
    else hideAllOverlays();
  },
  onLevelComplete(index) {
    setUnlocked(index + 1);
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
  btn.textContent = "上传分数";
  nameInput.disabled = false;
  const saved = localStorage.getItem("mario_name");
  if (saved) nameInput.value = saved;
}

// ---- Level select ---------------------------------------------------------
const LEVEL_EMOJI = { day: "☀️", dusk: "🌆", night: "🌙", snow: "❄️", cave: "🕳️", water: "🌊", castle: "🏰" };

function buildLevelGrid() {
  const grid = $("level-grid");
  const unlocked = getUnlocked();
  grid.innerHTML = "";
  LEVELS.forEach((def, i) => {
    const btn = document.createElement("button");
    const locked = i > unlocked;
    btn.className = "level-btn" + (def.boss ? " boss" : "") + (locked ? " locked" : "");
    const emoji = def.boss ? "👹" : LEVEL_EMOJI[def.bg] || "🎮";
    btn.innerHTML = `<span class="lv-emoji">${locked ? "🔒" : emoji}</span><span>${def.name}</span>`;
    if (!locked) {
      btn.addEventListener("click", () => {
        audio.unlock();
        hideAllOverlays();
        game.startAt(i);
      });
    }
    grid.appendChild(btn);
  });
}

// ---- Buttons --------------------------------------------------------------
$("btn-start").addEventListener("click", () => {
  audio.unlock();
  hideAllOverlays();
  game.start();
});

$("btn-select").addEventListener("click", () => {
  buildLevelGrid();
  show("select");
});
$("btn-select-back").addEventListener("click", () => show("title"));

$("btn-resume").addEventListener("click", () => {
  if (game.state === STATE.PAUSED) {
    game.state = STATE.PLAYING;
    game.playTheme();
    hideAllOverlays();
  }
});

$("btn-quit").addEventListener("click", () => {
  game.state = STATE.TITLE;
  audio.stopTheme();
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
  const name = (nameInput.value || "无名氏").trim();
  localStorage.setItem("mario_name", name);
  btn.disabled = true;
  btn.textContent = "保存中…";
  nameInput.disabled = true;
  const res = await submitScore({ ...lastStats, name });
  if (res && res.entry) {
    submittedId = res.entry.id;
    btn.textContent = res.rank ? `已保存 · 排名 #${res.rank}` : "已保存！";
  } else {
    btn.textContent = "重试上传";
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
    list.innerHTML = '<li class="empty">还没有记录，快来抢第一！</li>';
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

["player-name", "player-name-win"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const btn = id === "player-name" ? $("btn-submit-score") : $("btn-submit-score-win");
      btn.click();
    }
  });
});

// ---- On-screen key feedback ----------------------------------------------
const kfChips = Array.from(document.querySelectorAll(".kf"));
function updateKeyFeedback() {
  for (const chip of kfChips) {
    const act = chip.dataset.act;
    chip.classList.toggle("active", input.held.has(act));
  }
  requestAnimationFrame(updateKeyFeedback);
}
requestAnimationFrame(updateKeyFeedback);

// ---- Boot -----------------------------------------------------------------
show("title");
refreshLeaderboard();
game.startLoop();
