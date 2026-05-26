require("dotenv").config();
const express        = require("express");
const path           = require("path");
const { createStore } = require("./stores");
const { runJokeAgent } = require("./agent/jokeAgent");
const { usageTracker } = require("./usage/usageTracker");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Initialise the joke store (local file or vector DB) ─────────────────── */
const store = createStore();

/* Hot-reload the local store on SIGHUP (kill -HUP <pid>) */
process.on("SIGHUP", () => {
  if (typeof store.reload === "function") {
    console.log("🔄  Reloading joke store...");
    store.reload();
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let ratings = [];

/* ── Routes ──────────────────────────────────────────────────────────────── */

/**
 * POST /get-joke
 * Body: { mood: string }
 *
 * Passes the raw mood string to the AI agent, which:
 *   1. Interprets the mood in natural language
 *   2. Calls the pick_jokes tool against the configured store
 *   3. Returns the single best-matching joke
 */
app.post("/get-joke", async (req, res) => {
  const mood = (req.body.mood || "").trim();

  if (!mood) {
    return res.status(400).json({ error: "mood is required" });
  }

  try {
    console.log(`😊  /get-joke mood="${mood}"`);
    const joke = await runJokeAgent(mood, store);
    res.json({ joke, mood });
  } catch (err) {
    console.error("❌  Agent error:", err.message);
    res.status(500).json({ error: "The joke agent encountered an error. Please try again." });
  }
});

/**
 * POST /rate-joke
 * Body: { mood, joke, rating }
 */
app.post("/rate-joke", (req, res) => {
  const { mood, joke, rating } = req.body;
  ratings.push({ mood, joke, rating: Number(rating), time: new Date() });
  console.log(`⭐  /rate-joke rating=${rating} mood="${mood}"`);
  res.json({ message: "Thanks for your feedback!" });
});

/**
 * GET /usage
 * Returns cumulative Anthropic API usage for this server process:
 *   • Token counters (input / output / cache create / cache read) — total + per-model
 *   • Estimated cost in USD, calculated from configured per-MTok pricing
 *   • Latest rate-limit snapshot (request/token limits + reset timestamps)
 *   • Session start time + uptime
 *
 * Counters reset on server restart. Anthropic does not expose a remaining-
 * credit-balance endpoint via the public API — the `rateLimits` section is
 * the closest signal we can surface.
 */
app.get("/usage", (req, res) => {
  res.json(usageTracker.getSummary());
});

/**
 * GET /stats
 * Returns aggregate rating data.
 */
app.get("/stats", (req, res) => {
  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(2)
    : null;
  res.json({ totalRatings: ratings.length, averageRating: avg, ratings });
});

app.listen(PORT, () => {
  const storeType = (process.env.STORE || "local").toUpperCase();
  console.log(`✅  Mood Joke Generator running → http://localhost:${PORT}`);
  console.log(`📦  Store: ${storeType}`);
  console.log(`🤖  Agent Model: ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"}`);
});
