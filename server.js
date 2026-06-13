import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const MAX_ENTRIES = 100;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LEADERBOARD_FILE);
  } catch {
    await fs.writeFile(LEADERBOARD_FILE, "[]", "utf8");
  }
}

async function readLeaderboard() {
  try {
    const raw = await fs.readFile(LEADERBOARD_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Serialize writes so concurrent requests can't corrupt the file.
let writeChain = Promise.resolve();
function writeLeaderboard(entries) {
  writeChain = writeChain.then(() =>
    fs.writeFile(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), "utf8")
  );
  return writeChain;
}

function sanitizeName(name) {
  return String(name ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, 16) || "ANON";
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

// GET top scores (optionally limited via ?limit=N)
app.get("/api/leaderboard", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), MAX_ENTRIES);
  const entries = await readLeaderboard();
  entries.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
  res.json(entries.slice(0, limit));
});

// POST a new score
app.post("/api/leaderboard", async (req, res) => {
  const { name, score, level, coins, timeMs } = req.body || {};

  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 0 || numScore > 10_000_000) {
    return res.status(400).json({ error: "Invalid score" });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: sanitizeName(name),
    score: Math.floor(numScore),
    level: Math.max(0, Math.min(99, Math.floor(Number(level) || 1))),
    coins: Math.max(0, Math.floor(Number(coins) || 0)),
    timeMs: Math.max(0, Math.floor(Number(timeMs) || 0)),
    date: new Date().toISOString(),
  };

  const entries = await readLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
  const trimmed = entries.slice(0, MAX_ENTRIES);
  await writeLeaderboard(trimmed);

  const rank = trimmed.findIndex((e) => e.id === entry.id) + 1;
  res.status(201).json({ entry, rank: rank || null, total: trimmed.length });
});

// Simple health check
app.get("/api/health", (_req, res) => res.json({ status: "ok", time: Date.now() }));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

await ensureStore();
app.listen(PORT, () => {
  console.log(`🍄 Super Mario server running at http://localhost:${PORT}`);
});

export default app;
