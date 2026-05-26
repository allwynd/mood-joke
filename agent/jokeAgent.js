const Anthropic = require("@anthropic-ai/sdk");
const { usageTracker } = require("../usage/usageTracker");

const client = new Anthropic();
const MODEL  = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";


/**
 * runJokeAgent
 *
 * Agentic loop:
 *   1. Send user's raw mood + tool definition to the LLM
 *   2. LLM classifies the mood (free-form category) and calls pick_jokes({ category, query })
 *   3. We run a keyword search over the flat joke corpus, combining the agent's
 *      category and query into a single search string
 *   4. LLM receives the candidates and selects the single best joke
 *   5. Return that joke string
 *
 * Note: categories are NOT predefined — the agent invents whatever label best
 * captures the user's mood (e.g. "heartbroken", "post-deadline-relief").
 *
 * @param {string}    rawMood  Free-text mood from the UI ("exhausted after a red-eye flight")
 * @param {JokeStore} store    Any JokeStore implementation (local or vector)
 * @returns {Promise<string>}  The selected joke
 */
async function runJokeAgent(rawMood, store) {
  /* ── Tool definition ─────────────────────────────────────────────────── */
  const tools = [
    {
      name: "pick_jokes",
      description:
        "Retrieve candidate jokes from the datastore that best match the user's mood. " +
        "Call this once with your own interpretation of the mood, then choose the single " +
        "most appropriate joke to return to the user.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "A short label you choose to classify the user's mood — e.g. 'tired', " +
              "'heartbroken', 'pumped-up', 'anxious'. There is no fixed list; pick " +
              "whatever single word or hyphenated phrase best captures the emotion.",
          },
          query: {
            type: "string",
            description:
              "A short semantic search query derived from the user's mood, used to " +
              "find thematically relevant jokes (e.g. 'exhausted sleepy long flight').",
          },
          topK: {
            type: "number",
            description: "How many candidate jokes to retrieve. Defaults to 5.",
          },
        },
        required: ["category", "query"],
      },
    },
  ];

  /* ── System prompt ───────────────────────────────────────────────────── */
  const system =
    "You are a joke curator. Your job is to understand the user's mood — however they " +
    "describe it — and find the joke from our datastore that will make them laugh the most. " +
    "First decide on your own short category label for the mood, then call the pick_jokes " +
    "tool to fetch candidates. " +
    "Finally, respond with ONLY the joke text — no preamble, no explanation, just the joke.";

  /* ── Message history (grows through the agentic loop) ───────────────── */
  const messages = [
    {
      role: "user",
      content: `The user's current mood: "${rawMood}"`,
    },
  ];

  /* ── Agentic loop ────────────────────────────────────────────────────── */
  let iterations = 0;
  const MAX_ITERATIONS = 5; // safety cap

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    /* .withResponse() returns both the parsed body and the raw HTTP response,
       so we can capture rate-limit headers in addition to token usage. */
    const { data: response, response: httpResponse } = await client.messages
      .create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools,
        messages,
      })
      .withResponse();

    usageTracker.record({ model: response.model || MODEL, usage: response.usage });
    usageTracker.recordRateLimit(httpResponse.headers);

    console.log(`🤖  [Agent] iteration=${iterations} stop_reason=${response.stop_reason}`);

    /* ── Agent is done — extract the joke text ── */
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(b => b.type === "text");
      if (!textBlock) throw new Error("Agent returned no text");
      return textBlock.text.trim();
    }

    /* ── Agent wants to call a tool ─────────────── */
    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        console.log(`🔧  [Agent] tool_call=${block.name}`, block.input);

        if (block.name === "pick_jokes") {
          const { category, query, topK = 5 } = block.input;

          // Combine the agent's category and query so both inform the search.
          const searchTerms = [category, query].filter(Boolean).join(" ");
          const candidates  = await store.search(searchTerms, topK);

          console.log(`📦  [Agent] candidates found: ${candidates.length} (category="${category}")`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ candidates, category, query }),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Unknown tool: ${block.name}`,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  throw new Error(`Agent did not resolve within ${MAX_ITERATIONS} iterations`);
}

module.exports = { runJokeAgent };
