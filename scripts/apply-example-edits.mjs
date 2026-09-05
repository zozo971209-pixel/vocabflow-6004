import fs from "node:fs";
import assert from "node:assert/strict";

const path = "public/bilingual-examples.json";
const raw = fs.readFileSync(path, "utf8");
const payload = JSON.parse(raw);
const words = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const ids = new Set(words.map(word => word.id));
const rows = file => fs.readFileSync(file, "utf8").trim().split(/\r?\n/).map(line => line.split("\t"));
const posRows = rows("scripts/data/example-pos-edits.tsv");
const textRows = rows("scripts/data/example-text-edits.tsv");
assert.equal(new Set(posRows.map(row => row[0])).size, posRows.length, "Duplicate POS edit");
assert.equal(new Set(textRows.map(row => row[0])).size, textRows.length, "Duplicate text edit");
const pos = Object.fromEntries(posRows);
const texts = Object.fromEntries(textRows.map(([id, ...values]) => [id, values]));
let metadataEdits = 0;
let sentenceEdits = 0;
for (const [id, newPos] of posRows) {
  assert(ids.has(Number(id)), `Invalid word ID ${id}`);
  const records = payload.words[id];
  assert(records?.length);
  const word = words.find(word => word.id === Number(id));
  const normalizePos = value => ({ a: "adj", ad: "adv", r: "adv", s: "adj", vt: "v", vi: "v" }[value] ?? value);
  const official = (word.pos.match(/[a-z]+/g) ?? []).map(normalizePos);
  assert(official.includes(newPos), `${word.word}: new POS is outside the official listed scope`);
  const index = records.findIndex(example => !official.includes(normalizePos(example.pos.replaceAll(".", ""))));
  // Idempotent reruns may find the previous AI editorial record instead.
  const targetIndex = index >= 0 ? index : records.findIndex(example => example.editorialRevision === "2026-09-learning-quality");
  assert(targetIndex >= 0, `Expected an identifiable correction target for ${word.word}`);
  if (texts[id]) {
    const [en, zh, targetEn, targetZh] = texts[id];
    const escaped = targetEn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i").exec(en);
    assert(match && zh.includes(targetZh), `Invalid highlight: ${word.word}`);
    const enStart = match.index;
    const zhStart = zh.indexOf(targetZh);
    records[targetIndex] = { en, zh, enStart, enEnd: enStart + targetEn.length, zhStart, zhEnd: zhStart + targetZh.length, targetEn: match[0], targetZh, senseZh: targetZh, pos: newPos, origin: "ai-generated", qualityScore: 0, editorialRevision: "2026-09-learning-quality" };
    sentenceEdits++;
  } else {
    records[targetIndex] = { ...records[targetIndex], pos: newPos, editorialRevision: "2026-09-learning-quality" };
    metadataEdits++;
  }
}
for (const id of Object.keys(texts)) assert(pos[id], `A sentence edit requires a POS review: ${id}`);
const all = Object.values(payload.words).flat();
payload.stats = { ...payload.stats, totalWords: words.length, wordsWithExamples: Object.keys(payload.words).length, totalExamples: all.length, corpusExamples: all.filter(x => x.englishSentenceId).length, aiGeneratedExamples: all.filter(x => !x.englishSentenceId).length };
payload.editorialRevision = { id: "2026-09-learning-quality", metadataEdits, sentenceEdits, notice: "AI 修訂與逐筆文字檢查，不是人工核對；未修改的句子不因此取得品質保證。" };
fs.mkdirSync("outputs", { recursive: true });
const archive = "outputs/bilingual-examples-before-editorial.json";
if (!fs.existsSync(archive)) fs.writeFileSync(archive, raw);
fs.writeFileSync(process.argv.includes("--apply") ? path : "outputs/bilingual-examples-editorial-preview.json", JSON.stringify(payload));
console.log(JSON.stringify({ metadataEdits, sentenceEdits, totalExamples: all.length, applied: process.argv.includes("--apply") }));
