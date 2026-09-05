import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

async function load(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { editedExamples, editedEnrichment, contentEditorial } = await load("app/contentEditorial.ts");
const words = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const examples = JSON.parse(fs.readFileSync("public/bilingual-examples.json", "utf8"));
const enrichment = JSON.parse(fs.readFileSync("public/enrichment-ai.json", "utf8"));
const report = { words: words.length, examples: 0, editorialWords: Object.keys(contentEditorial).length, errors: [], posWarnings: [], missingGlosses: [], noCollocations: [], noSentencePatterns: [] };
const normalizePos = value => ({ a: "adj", s: "adj", r: "adv", ad: "adv", vt: "v", vi: "v" }[value] ?? value);
for (const word of words) {
  const edited = contentEditorial[word.id];
  if (edited) assert.equal(edited.headword, word.word, `Editorial identity mismatch: ${word.id}`);
  const records = editedExamples(word.id) ?? examples.words[word.id];
  if (!records?.length) report.errors.push({ id: word.id, error: "no example" });
  const officialPos = (word.pos.match(/[a-z]+/g) ?? []).map(normalizePos);
  for (const example of records ?? []) {
    report.examples++;
    if (example.enStart < 0 || example.zhStart < 0 || example.en.slice(example.enStart, example.enEnd) !== example.targetEn || example.zh.slice(example.zhStart, example.zhEnd) !== example.targetZh || !/[\u3400-\u9fff]/.test(example.zh) || /\[object Object\]|TODO|待補/.test(example.en + example.zh)) {
      report.errors.push({ id: word.id, error: "invalid bilingual span/content", example });
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
console.log(JSON.stringify({ ...report, errors: report.errors.length, posWarnings: report.posWarnings.length, missingGlosses: report.missingGlosses.length, noCollocations: report.noCollocations.length, noSentencePatterns: report.noSentencePatterns.length }, null, 2));
assert.equal(report.errors.length, 0, "Invalid examples must be fixed before release");
