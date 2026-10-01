import fs from "node:fs";
import assert from "node:assert/strict";

const vocab = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const payload = JSON.parse(fs.readFileSync("public/source-examples.json", "utf8"));
const ids = new Set(vocab.map((word) => String(word.id)));
const report = { words: vocab.length, sourceWords: Object.keys(payload.words ?? {}).length, examples: 0, errors: [] };
const rejectPatterns = [
  /\baccordance to\b/i,
  /\bthe accordance of\b/i,
  /\b(?:a|an) potential problem\b/i,
  /\bthe liquids, light, and gases absorb\b/i,
  /\bthey write them the information\b/i,
];

for (const [id, records] of Object.entries(payload.words ?? {})) {
  if (!ids.has(id)) report.errors.push({ id, error: "unknown word id" });
  if (!Array.isArray(records) || !records.length || records.length > 2) report.errors.push({ id, error: "unexpected record count" });
  for (const record of records ?? []) {
    report.examples += 1;
    const hasTarget = typeof record.en === "string" && typeof record.targetEn === "string" && record.targetEn.length > 0 && record.en.toLowerCase().includes(record.targetEn.toLowerCase());
    const validSource = record.sourceType === "open-wordnet" && record.sourceTitle === "Open English Wordnet 2025" && record.sourceLicense === "CC BY 4.0" && record.sourceUrl === "https://en-word.net/" && record.sourceLicenseUrl === "https://creativecommons.org/licenses/by/4.0/" && record.reviewStatus === "source-backed";
    const rejected = typeof record.en === "string" && rejectPatterns.some((pattern) => pattern.test(record.en));
    if (!hasTarget || !validSource || rejected || !["sentence", "usage-fragment"].includes(record.exampleKind) || typeof record.en !== "string" || record.en.length < 12 || record.en.length > 180) {
      report.errors.push({ id, error: "invalid source example", record });
    }
  }
}

fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/source-examples-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(report.errors.length, 0, "Source example provenance must be valid before release");
