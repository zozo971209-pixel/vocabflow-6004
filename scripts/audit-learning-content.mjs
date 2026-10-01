import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

async function load(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { editedEnrichment, contentEditorial } = await load("app/contentEditorial.ts");
const words = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const examples = JSON.parse(fs.readFileSync("public/bilingual-examples.json", "utf8"));
const sourceExamples = JSON.parse(fs.readFileSync("public/source-examples.json", "utf8"));
const canonicalExamples = JSON.parse(fs.readFileSync("public/canonical-examples.json", "utf8"));
const enrichment = JSON.parse(fs.readFileSync("public/enrichment-ai.json", "utf8"));
const report = { words: words.length, canonicalSenseExamples: 0, canonicalExampleWords: 0, examples: 0, wordnetExamples: 0, sourceExampleWords: 0, noCanonicalExamples: [], editorialWords: Object.keys(contentEditorial).length, errors: [], posWarnings: [], missingGlosses: [], noCollocations: [], noSentencePatterns: [] };
const normalizePos = value => ({ a: "adj", s: "adj", r: "adv", ad: "adv", vt: "v", vi: "v" }[value] ?? value);
const sourceTypes = new Set(["tatoeba", "open-wordnet"]);
for (const word of words) {
  const edited = contentEditorial[word.id];
  if (edited) assert.equal(edited.headword, word.word, `Editorial identity mismatch: ${word.id}`);
  const records = examples.words[word.id] ?? [];
  const displayableRecords = records.filter((record) => record.qualityScore >= 40);
  const wordnetRecords = sourceExamples.words?.[word.id] ?? [];
  const canonicalRecords = canonicalExamples.words?.[word.id] ?? [];
  report.canonicalSenseExamples += canonicalRecords.length;
  if (canonicalRecords.length) report.canonicalExampleWords++;
  else report.noCanonicalExamples.push({ id: word.id, word: word.word });
  for (const record of canonicalRecords) {
    if (!record.senseId || !record.pos || !record.meaning || !record.explanation || !record.en || !record.zh || !Array.isArray(record.targetForms) || !record.targetForms.length || !/[A-Za-z]/.test(record.en) || !/[\u3400-\u9fff]/.test(record.zh)) {
      report.errors.push({ id: word.id, error: "invalid canonical example", record });
    }
  }
  report.wordnetExamples += wordnetRecords.length;
  if (displayableRecords.length || wordnetRecords.length) report.sourceExampleWords++;
  const officialPos = (word.pos.match(/[a-z]+/g) ?? []).map(normalizePos);
  for (const example of records ?? []) {
    report.examples++;
    if (!sourceTypes.has(example.sourceType) || !example.sourceUrl || !example.sourceTitle || !example.sourceLicense || !example.sourceLicenseUrl) {
      report.errors.push({ id: word.id, error: "missing source provenance", example });
    }
    if (example.sourceType === "tatoeba" && (example.enStart < 0 || example.zhStart < 0 || example.en.slice(example.enStart, example.enEnd) !== example.targetEn || example.zh.slice(example.zhStart, example.zhEnd) !== example.targetZh || !/[\u3400-\u9fff]/.test(example.zh) || /\[object Object\]|TODO|待補/.test(example.en + example.zh))) {
      report.errors.push({ id: word.id, error: "invalid bilingual span/content", example });
    }
    if (example.sourceType === "open-wordnet" && (example.enStart < 0 || example.en.slice(example.enStart, example.enEnd) !== example.targetEn || /\[object Object\]|TODO|待補/.test(example.en))) {
      report.errors.push({ id: word.id, error: "invalid source example span/content", example });
    }
    if (!officialPos.includes(normalizePos(example.pos.replaceAll(".", "")))) report.posWarnings.push({ id: word.id, word: word.word, official: word.pos, example });
  }
  const data = editedEnrichment(word.id, enrichment.words[word.id]);
  if (!data?.collocations.length) report.noCollocations.push({ id: word.id, word: word.word });
  if (!data?.collocations.length && !data?.sentencePatterns?.length) report.noSentencePatterns.push({ id: word.id, word: word.word });
  for (const category of ["family", "collocations", "sentencePatterns", "phrases", "synonyms", "antonyms"]) {
    for (const en of data?.[category] ?? []) {
      const key = en.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
      if (!(data?.glosses?.[key] ?? enrichment.glosses[key])) report.missingGlosses.push({ id: word.id, category, en });
    }
  }
}
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/learning-content-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, noCanonicalExamples: report.noCanonicalExamples.length, errors: report.errors.length, posWarnings: report.posWarnings.length, missingGlosses: report.missingGlosses.length, noCollocations: report.noCollocations.length, noSentencePatterns: report.noSentencePatterns.length }, null, 2));
assert.equal(report.words, 6004, "Canonical web vocabulary must contain exactly 6,004 words");
assert.equal(new Set(words.map((word) => word.id)).size, 6004, "Canonical word IDs must be unique");
assert.equal(Math.min(...words.map((word) => word.id)), 1, "Canonical word IDs must begin at 1");
assert.equal(Math.max(...words.map((word) => word.id)), 6004, "Canonical word IDs must end at 6004");
assert.equal(report.noCanonicalExamples.length, 0, "Every canonical word must have at least one bilingual example");
assert.equal(report.errors.length, 0, "Invalid examples must be fixed before release");
