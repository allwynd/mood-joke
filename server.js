const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const jokes = {
  happy: [
    "Why don’t scientists trust atoms? Because they make up everything!",
    "Why did the cookie go to the doctor? Because it felt crummy!",
    "Why did the scarecrow win an award? He was outstanding in his field!"
  ],
  sad: [
    "Why don’t skeletons fight each other? They don’t have the guts.",
    "I told my laptop I needed a break… now it won’t stop sending me vacation ads.",
    "Why did the math book look sad? Too many problems."
  ],
  angry: [
    "Why did the tomato turn red? Because it saw the salad dressing!",
    "Why did the coffee file a police report? It got mugged!",
    "Why don’t eggs tell jokes? They’d crack each other up."
  ],
  tired: [
    "I’m reading a book on anti-gravity. It’s impossible to put down!",
    "Why did the bed break up with the pillow? Too much fluff.",
    "Sleep is my favorite hobby."
  ],
  stressed: [
    "Why did the calendar go to therapy? Too many dates.",
    "Parallel lines have so much in common… it’s a shame they’ll never meet.",
    "Why was the computer cold? It left its Windows open."
  ],
  default: [
    "Why was six afraid of seven? Because seven eight nine!",
    "Why can’t your nose be 12 inches long? Because then it would be a foot!",
    "I would tell you a construction joke… but I’m still working on it."
  ]
};

let ratings = [];

app.post("/get-joke", (req, res) => {
  const mood = req.body.mood.toLowerCase();

  const moodJokes = jokes[mood] || jokes.default;

  const randomJoke =
    moodJokes[Math.floor(Math.random() * moodJokes.length)];

  res.json({ joke: randomJoke });
});

app.post("/rate-joke", (req, res) => {
  const { mood, joke, rating } = req.body;

  ratings.push({
    mood,
    joke,
    rating,
    time: new Date()
  });

  console.log("New Rating:", ratings);

  res.json({ message: "Thanks for your feedback!" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});