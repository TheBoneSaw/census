const https = require("https");

const DRIVE_FILE_URL =
  "https://67f031b6af4416c620b20103--playful-melomakarona-d83681.netlify.app/census_datasets_detailed.json";

function fetchJsonFromDrive(url) {
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
            reject("Failed to parse JSON from Google Drive");
          }
        });
      })
      .on("error", reject);
  });
}

function searchDatasets(datasets, query, limit = 5) {
  const q = query.toLowerCase();
  return datasets
    .filter((d) => {
      const text = [d.title, d.description, d.summary, ...(d.keywords || [])]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    })
    .slice(0, limit)
    .map((d) => ({
      title: d.title,
      identifier: d.identifier,
      summary: d.summary,
      variables: d.variables
        ? Object.fromEntries(Object.entries(d.variables).slice(0, 10))
        : {}
    }));
}

module.exports = async (req, res) => {
  const { q = "", limit = "5" } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing 'q' query param" });
  }

  try {
    const datasets = await fetchJsonFromDrive(DRIVE_FILE_URL);
    const results = searchDatasets(datasets, q, parseInt(limit));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
};
