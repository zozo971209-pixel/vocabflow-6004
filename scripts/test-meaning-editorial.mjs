import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { applyMeaningEditorial, isPrimaryMeaning, meaningEditorial } = await loadTs("app/meaningEditorial.ts");
const { parseMeaningGroups } = await loadTs("app/meaningGroups.ts");
const { isChineseMeaningCorrect } = await loadTs("app/quizAnswers.ts");
const words = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const before = JSON.stringify(words);
const corrected = words.map(applyMeaningEditorial);
assert.equal(JSON.stringify(words), before, "Original source must remain unchanged");
assert.deepEqual(corrected.map(w => [w.id, w.level, w.pos]), words.map(w => [w.id, w.level, w.pos]));
const pm = corrected.find(w => w.id === 3996);
assert(isChineseMeaningCorrect("下午", pm.meaning));
assert(!isChineseMeaningCorrect("軍需官", pm.meaning));
const am = corrected.find(w => w.id === 188);
assert(isChineseMeaningCorrect("上午", am.meaning));
assert(!isChineseMeaningCorrect("be的單數第一人稱", am.meaning));
assert(isPrimaryMeaning(4057, "potential", "a.", "潛在的"));
assert(isPrimaryMeaning(4057, "potential", "n.", "潛力"));
assert(!isPrimaryMeaning(4057, "potential", "n.", "勢"));
assert(!isPrimaryMeaning(4057, "potential", "n.", "潛在的"));
assert(!isPrimaryMeaning(4057, "wrong-headword", "n.", "潛力"));
assert(!isPrimaryMeaning(4047, "possible", "a.", "可能的"), "Unaudited entries must not auto-bold");
for (const [id, entry] of Object.entries(meaningEditorial)) {
  const word = corrected.find(w => w.id === Number(id));
  assert.equal(word.word, entry.headword);
  assert(entry.reason && entry.sources.length);
  const groups = parseMeaningGroups(word.meaning, word.pos);
  for (const [pos, senses] of Object.entries(entry.primary)) {
    for (const sense of senses) {
      assert(groups.some(g => !g.sourceField && g.senses.includes(sense) && isPrimaryMeaning(word.id, word.word, g.abbreviation, sense)), `${id} ${pos} ${sense} must match a rendered sense`);
    }
  }
}
console.log("PASS: source preservation, stable IDs, corrected quiz answers, POS-specific highlighting, no unaudited fallback");
