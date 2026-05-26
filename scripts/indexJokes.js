/**
 * scripts/indexJokes.js
 *
 * One-time script: reads randomJokes.txt, embeds each joke, and upserts into your
 * configured vector database.
 *
 * Run once (or whenever randomJokes.txt changes):
 *   node scripts/indexJokes.js
 *
 * Prerequisites:
 *   1. npm install openai @pinecone-database/pinecone   (or your chosen providers)
 *   2. Fill in your env vars in .env
 *   3. Create the Pinecone index with dimension=1536, metric=cosine
 *      (or the right dimension for your embedding model)
 */

require("dotenv").config();
const fs   = require("fs");
const path = require("path");

/* ── Config ─────────────────────────────────────────────────────────────── */
const JOKES_FILE = process.env.JOKES_FILE || path.join(__dirname, "..", "randomJokes.txt");
const INDEX_NAME = process.env.VECTOR_INDEX_NAME || "mood-jokes";
const BATCH_SIZE = 20; // upsert in batches to respect rate limits

/* ── Load jokes ─────────────────────────────────────────────────────────── */
const raw   = fs.readFileSync(JOKES_FILE, "utf8");
const lines = raw
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith("#"));

const records = lines.map((text, i) => ({
  id: `joke-${i}`,
  text,
}));

console.log(`📖  Loaded ${records.length} jokes from ${JOKES_FILE}`);

/* ── Embedding helper (OpenAI) ──────────────────────────────────────────── */
async function embedBatch(texts) {
  // Uncomment after: npm install openai
  // const { OpenAI } = require("openai");
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const res = await openai.embeddings.create({
  //   model: "text-embedding-3-small",  // 1536 dimensions
  //   input: texts,
  // });
  // return res.data.map(d => d.embedding);

  throw new Error("embedBatch() not implemented — uncomment your chosen provider above");
}

/* ── Upsert helpers ─────────────────────────────────────────────────────── */

// ── Pinecone ──────────────────────────────────────────────────────────────
async function upsertToPinecone(records) {
  // const { Pinecone } = require("@pinecone-database/pinecone");
  // const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  // const index = pc.index(INDEX_NAME);
  //
  // for (let i = 0; i < records.length; i += BATCH_SIZE) {
  //   const batch    = records.slice(i, i + BATCH_SIZE);
  //   const texts    = batch.map(r => r.text);
  //   const vectors  = await embedBatch(texts);
  //   const upserts  = batch.map((r, j) => ({
  //     id:       r.id,
  //     values:   vectors[j],
  //     metadata: { text: r.text },
  //   }));
  //   await index.upsert(upserts);
  //   console.log(`✅  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  // }

  throw new Error("upsertToPinecone() not implemented — uncomment the block above");
}

// ── Qdrant ────────────────────────────────────────────────────────────────
async function upsertToQdrant(records) {
  // const { QdrantClient } = require("@qdrant/js-client-rest");
  // const client = new QdrantClient({ url: process.env.QDRANT_URL });
  //
  // // Create collection if it doesn't exist
  // await client.recreateCollection(INDEX_NAME, {
  //   vectors: { size: 1536, distance: "Cosine" },
  // });
  //
  // for (let i = 0; i < records.length; i += BATCH_SIZE) {
  //   const batch   = records.slice(i, i + BATCH_SIZE);
  //   const texts   = batch.map(r => r.text);
  //   const vectors = await embedBatch(texts);
  //   await client.upsert(INDEX_NAME, {
  //     points: batch.map((r, j) => ({
  //       id:      i + j,
  //       vector:  vectors[j],
  //       payload: { text: r.text },
  //     })),
  //   });
  //   console.log(`✅  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  // }

  throw new Error("upsertToQdrant() not implemented — uncomment the block above");
}

/* ── Main ───────────────────────────────────────────────────────────────── */
async function main() {
  const target = (process.env.VECTOR_PROVIDER || "pinecone").toLowerCase();
  console.log(`🚀  Indexing ${records.length} jokes into ${target} (index: ${INDEX_NAME})`);

  switch (target) {
    case "pinecone": await upsertToPinecone(records); break;
    case "qdrant":   await upsertToQdrant(records);   break;
    default:
      throw new Error(`Unknown VECTOR_PROVIDER="${target}". Choose: pinecone | qdrant`);
  }

  console.log("🎉  Indexing complete!");
}

main().catch(err => {
  console.error("❌  Indexing failed:", err.message);
  process.exit(1);
});
