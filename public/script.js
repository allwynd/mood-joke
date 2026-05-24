const getJokeBtn = document.getElementById("getJokeBtn");
const jokeText = document.getElementById("jokeText");
const moodSelect = document.getElementById("moodSelect");
const customMood = document.getElementById("customMood");
const message = document.getElementById("message");

let currentJoke = "";
let currentMood = "";

async function fetchJoke() {
  currentMood =
    customMood.value.trim() || moodSelect.value;

  const response = await fetch("/get-joke", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mood: currentMood
    })
  });

  const data = await response.json();

  currentJoke = data.joke;

  jokeText.innerText = currentJoke;
  message.innerText = "";
}

getJokeBtn.addEventListener("click", fetchJoke);

document.getElementById("continueBtn")
  .addEventListener("click", fetchJoke);

document.getElementById("stopBtn")
  .addEventListener("click", () => {
    jokeText.innerText =
      "Thanks for using Mood Joke Generator 😂";
  });

document.querySelectorAll(".rate-btn")
  .forEach(button => {
    button.addEventListener("click", async () => {

      const rating = button.dataset.rate;

      await fetch("/rate-joke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mood: currentMood,
          joke: currentJoke,
          rating
        })
      });

      message.innerText =
        "Thanks for rating this joke ❤️";
    });
  });