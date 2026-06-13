// Thin client for the backend leaderboard API.

export async function fetchLeaderboard(limit = 10) {
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Leaderboard fetch failed:", err);
    return [];
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
  } catch (err) {
    console.warn("Score submit failed:", err);
    return null;
  }
}
