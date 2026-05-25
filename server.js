const express = require("express");
const path    = require("path");

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ── Joke bank ──────────────────────────────── */
const jokes = {
  happy: [
    "Why don't scientists trust atoms? Because they make up everything!",
    "Why did the cookie go to the doctor? Because it felt crummy!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "What do you call a fish without eyes? A fsh!"
  ],
  sad: [
    "Why don't skeletons fight each other? They don't have the guts.",
    "I told my laptop I needed a break… now it won't stop sending me vacation ads.",
    "Why did the math book look sad? Too many problems.",
    "My wife told me to stop acting like a flamingo. I had to put my foot down."
  ],
  angry: [
    "Why did the tomato turn red? Because it saw the salad dressing!",
    "Why did the coffee file a police report? It got mugged!",
    "Why don't eggs tell jokes? They'd crack each other up.",
    "I told my doctor I broke my arm in two places. He told me to stop going to those places."
  ],
  tired: [
    "I'm reading a book on anti-gravity. It's impossible to put down!",
    "Why did the bed break up with the pillow? Too much fluff.",
    "I stayed up all night to see where the sun went. Then it dawned on me.",
    "My sleep schedule is like a teenager — completely out of control."
  ],
  stressed: [
    "Why did the calendar go to therapy? Too many dates.",
    "Parallel lines have so much in common… it's a shame they'll never meet.",
    "Why was the computer cold? It left its Windows open.",
    "I used to hate facial hair, but then it grew on me."
  ],
  default: [
    "Why was six afraid of seven? Because seven eight nine!",
    "Why can't your nose be 12 inches long? Because then it would be a foot!",
    "I would tell you a construction joke… but I'm still working on it.",
    "What do you call cheese that isn't yours? Nacho cheese!"
  ]
};

let ratings = [];

/* ── Routes ─────────────────────────────────── */
app.post("/get-joke", (req, res) => {
  const mood      = (req.body.mood || "").toLowerCase().trim();
  const moodJokes = jokes[mood] || jokes.default;
  const joke      = moodJokes[Math.floor(Math.random() * moodJokes.length)];
  res.json({ joke });
});

app.post("/rate-joke", (req, res) => {
  const { mood, joke, rating } = req.body;
  ratings.push({ mood, joke, rating: Number(rating), time: new Date() });
  console.log("Rating saved:", { mood, rating });
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