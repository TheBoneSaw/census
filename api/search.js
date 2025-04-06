const fs = require("fs");
const path = require("path");
const https = require("https");
const faiss = require("faiss-node");
const chunkMap = require("./chunk_map.json");

// === CONFIG ===
const NETLIFY_BASE_URL = "https://67f29c41c2817a5c8a60cef7--polite-sunshine-a568af.netlify.app/chunks_by_size";
const INDEX_PATH = path.join(__dirname, "census_index.faiss");

// === HELPERS ===
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(`Failed to parse JSON from ${url}`);
          }
        });
      })
      .on("error", reject);
  });
}

// === MAIN FUNCTION ===
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { embedding, limit = 5 } = req.body || {};

  if (!embedding || !Array.isArray(embedding)) {
    return res.status(400).json({ error: "Missing or invalid 'embedding' in request body." });
  }

  try {
    // 1. Load FAISS index
    const index = faiss.readIndexSync(INDEX_PATH);

    // 2. Perform search
    const queryVector = new Float32Array(embedding);
    const result = index.search(queryVector, limit);
    const matchIds = Array.from(result.labels[0]).filter((id) => id !== -1);

    // 3. Fetch matching metadata from Netlify
    const fetches = matchIds.map(async (id) => {
      const file = chunkMap[id.toString()];
      if (!file) return null;

      const url = `${NETLIFY_BASE_URL}/${file}`;
      const chunk = await fetchJson(url);
      return chunk.find((entry) => entry.global_id === id);
    });

    const results = await Promise.all(fetches);

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(results.filter(Boolean));
  } catch (err) {
    console.error("❌ Error in search handler:", err);
    return res.status(500).json({ error: err.toString() });
  }
};
