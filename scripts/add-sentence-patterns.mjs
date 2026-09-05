import fs from "node:fs";

const enrichmentPath = "public/enrichment-ai.json";
const examplesPath = "public/bilingual-examples.json";
const backupPath = "outputs/enrichment-before-sentence-patterns.json";

const enrichment = JSON.parse(fs.readFileSync(enrichmentPath, "utf8"));
const examples = JSON.parse(fs.readFileSync(examplesPath, "utf8"));
fs.mkdirSync("outputs", { recursive: true });
if (!fs.existsSync(backupPath)) fs.copyFileSync(enrichmentPath, backupPath);

const normalize = (value) => String(value).toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
let addedWords = 0;
let addedPatterns = 0;

for (const [wordId, data] of Object.entries(enrichment.words)) {
  if ((data.collocations ?? []).length > 0) continue;
  const candidates = (examples.words[wordId] ?? [])
    .filter((item) => item && typeof item.en === "string" && typeof item.zh === "string")
    .filter((item) => item.en.trim().split(/\s+/).length >= 4 && item.en.trim().split(/\s+/).length <= 18)
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  const selected = [];
  for (const item of candidates) {
    const key = normalize(item.en);
    if (!selected.some((entry) => normalize(entry.en) === key)) selected.push(item);
    if (selected.length === 2) break;
  }
  if (!selected.length) continue;
  data.sentencePatterns = selected.map((item) => item.en.trim());
  for (const item of selected) {
    const key = normalize(item.en);
    if (!enrichment.glosses[key]) enrichment.glosses[key] = item.zh.trim();
    addedPatterns += 1;
  }
  addedWords += 1;
}

enrichment.schemaVersion = 2;
enrichment.refinement = {
  ...(enrichment.refinement ?? {}),
  sentencePatterns: {
    source: "public/bilingual-examples.json",
    maxPerWord: 2,
    notice: "完整雙語句子獨立標示為句型練習，不冒充短搭配詞；選取依既有格式、詞彙位置與品質分數排序。",
  },
};
fs.writeFileSync(enrichmentPath, JSON.stringify(enrichment));
console.log(JSON.stringify({ addedWords, addedPatterns }, null, 2));
