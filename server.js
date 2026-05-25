const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app  = express();
const PORT = 3000;

/* ── Jokes config ───────────────────────────── */
const JOKES_FILE = process.env.JOKES_FILE
  ? path.resolve(process.env.JOKES_FILE)
  : path.join(__dirname, "jokes.json");

function loadJokes() {
  try {
    const raw = fs.readFileSync(JOKES_FILE, "utf8");
    const data = JSON.parse(raw);
    console.log(`✅  Loaded jokes from: ${JOKES_FILE}`);
    return data;
  } catch (err) {
    console.error(`❌  Failed to load jokes file (${JOKES_FILE}):`, err.message);
    process.exit(1);
  }
}

let jokes = loadJokes();

/* Reload jokes on SIGHUP so you can swap jokes.json without restarting */
process.on("SIGHUP", () => {
  console.log("🔄  Reloading jokes file...");
  jokes = loadJokes();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let ratings = [];

/* ── Routes ─────────────────────────────────── */
app.post("/get-joke", (req, res) => {
  const mood      = (req.body.mood || "").toLowerCase().trim();
  const moodJokes = jokes[mood] || jokes.default;

  if (!moodJokes || moodJokes.length === 0) {
    return res.status(404).json({ error: `No jokes found for mood: "${mood}"` });
  }

  const joke = moodJokes[Math.floor(Math.random() * moodJokes.length)];
  res.json({ joke, mood });
});

app.post("/rate-joke", (req, res) => {
  const { mood, joke, rating } = req.body;
  ratings.push({ mood, joke, rating: Number(rating), time: new Date() });
  //console.log("Rating saved:", { mood, rating });
  res.json({ message: "Thanks for your feedback!" });
});

/* ── Stats endpoint (bonus) ─────────────────── */
app.get("/stats", (req, res) => {
  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(2)
    : null;
  res.json({ totalRatings: ratings.length, averageRating: avg, ratings });
});

app.listen(PORT, () => {
  console.log(`✅  Mood Joke Generator running → http://localhost:${PORT}`);
});