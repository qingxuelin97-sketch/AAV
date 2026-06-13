// Leaderboard client. Talks to the Node backend when it's available (e.g. when
// you run `npm start`), and transparently falls back to the browser's
// localStorage when there is no backend — for example when the game is hosted
// as a static site on GitHub Pages. That way the leaderboard always works.

const LS_KEY = "mario_leaderboard_v1";
const MAX_ENTRIES = 100;

function readLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeLocal(entries) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    /* storage might be full or disabled; ignore */
  }
}

function sortEntries(entries) {
  return entries.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
}

function sanitizeName(name) {
  return (
    String(name ?? "")
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .slice(0, 16) || "ANON"
  );
}

export async function fetchLeaderboard(limit = 10) {
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // No backend — use the local leaderboard.
    return sortEntries(readLocal()).slice(0, limit);
  }
}

export async function submitScore({ name, score, level, coins, timeMs }) {
  try {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, level, coins, timeMs }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // No backend — save into localStorage and synthesize the same response.
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: sanitizeName(name),
      score: Math.max(0, Math.floor(Number(score) || 0)),
      level: Math.max(0, Math.floor(Number(level) || 1)),
      coins: Math.max(0, Math.floor(Number(coins) || 0)),
      timeMs: Math.max(0, Math.floor(Number(timeMs) || 0)),
      date: new Date().toISOString(),
      local: true,
    };
    const entries = sortEntries([...readLocal(), entry]).slice(0, MAX_ENTRIES);
    writeLocal(entries);
    const rank = entries.findIndex((e) => e.id === entry.id) + 1;
    return { entry, rank: rank || null, total: entries.length, local: true };
  }
}
