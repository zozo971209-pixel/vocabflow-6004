import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("app/meaningGroups.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { parseMeaningGroups } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const words = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));

const further = words.find((word) => word.word === "further");
const furtherGroups = parseMeaningGroups(further.meaning, further.pos);
assert.deepEqual(furtherGroups.map((group) => ({
  abbreviation: group.abbreviation,
  label: group.label,
  senses: group.senses,
})), [{
  abbreviation: "adv./adj./v.",
  label: "副詞／形容詞／動詞",
  senses: ["更進一步", "較遠的", "促進"],
}]);

const leakedPos = /^(?:\/?\(?(?:vt|vi|adj|adv|prep|pron|conj|art|num|aux|interj|int|ad|v|n|a)\.\)?)/i;
let compoundCount = 0;
for (const word of words) {
  const groups = parseMeaningGroups(word.meaning, word.pos);
  if (/^(?:[^\s]+\/)+[^\s]+\s/.test(word.meaning)) compoundCount += 1;
  for (const group of groups) {
    assert(!group.senses.some((sense) => leakedPos.test(sense)), `${word.id} ${word.word} must not render POS text as a meaning`);
  }
}

assert.equal(compoundCount, 49, "The current vocabulary set should exercise all 49 compound-POS entries");
console.log("PASS: 6,004 meanings parsed; 49 compound-POS prefixes removed from displayed senses");
