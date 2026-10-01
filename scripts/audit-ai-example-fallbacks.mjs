import fs from "node:fs";
import assert from "node:assert/strict";

const vocab = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const bilingual = JSON.parse(fs.readFileSync("public/bilingual-examples.json", "utf8"));
const sourceExamples = JSON.parse(fs.readFileSync("public/source-examples.json", "utf8"));
const fallback = JSON.parse(fs.readFileSync("public/ai-example-fallbacks.json", "utf8"));
const sourceIds = new Set(Object.entries(bilingual.words ?? {})
  .filter(([, records]) => records.some((record) => record.qualityScore >= 40))
  .map(([id]) => id));
for (const id of Object.keys(sourceExamples.words ?? {})) sourceIds.add(id);
const missing = vocab.filter((word) => !sourceIds.has(String(word.id)));
const missingIds = new Set(missing.map((word) => String(word.id)));
const report = { totalWords: vocab.length, expectedFallbackWords: missing.length, fallbackWords: Object.keys(fallback.words ?? {}).length, examples: 0, errors: [] };
const rejectPatterns = [
  /\baccordance to\b/i,
  /\bthe accordance of\b/i,
  /\b(?:a|an) potential problem\b/i,
  /\bthe liquids, light, and gases absorb\b/i,
  /\bthey write them the information\b/i,
  /\bthe river accumulates water from the rain\b/i,
  /\ba loud acclaim\b/i,
];
const tokenCount = (value) => (value.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []).length;

for (const id of Object.keys(fallback.words ?? {})) {
  if (!missingIds.has(id)) report.errors.push({ id, error: "fallback exists for a source-covered word" });
  const records = fallback.words[id];
  if (!Array.isArray(records) || records.length !== 1) report.errors.push({ id, error: "expected exactly one fallback" });
  for (const record of records ?? []) {
    report.examples += 1;
    const enStart = typeof record.en === "string" && typeof record.targetEn === "string" ? record.en.toLowerCase().indexOf(record.targetEn.toLowerCase()) : -1;
    const zhStart = typeof record.zh === "string" && typeof record.targetZh === "string" ? record.zh.indexOf(record.targetZh) : -1;
    const valid = record.sourceType === "ai-draft" && record.reviewStatus === "ai-draft" && record.origin === "ai-generated" &&
      enStart >= 0 && zhStart >= 0 && record.en.slice(enStart, enStart + record.targetEn.length).toLowerCase() === record.targetEn.toLowerCase() &&
      record.zh.slice(zhStart, zhStart + record.targetZh.length) === record.targetZh && /[\u3400-\u9fff]/.test(record.zh) &&
      tokenCount(record.en) >= 4 && tokenCount(record.en) <= 18 && /[.!?]$/.test(record.en) && /[。！？]$/.test(record.zh) &&
      !/\[object Object\]|TODO|待補/.test(`${record.en} ${record.zh}`) && !rejectPatterns.some((pattern) => pattern.test(`${record.en} ${record.zh}`));
    if (!valid) report.errors.push({ id, error: "invalid AI fallback record", record });
  }
}
for (const word of missing) if (!fallback.words?.[String(word.id)]) report.errors.push({ id: word.id, error: "missing fallback" });

fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/ai-example-fallbacks-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(report.errors.length, 0, "AI fallback examples must be complete and structurally valid");
