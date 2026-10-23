import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "public", "vocab.json");
const words = JSON.parse(fs.readFileSync(file, "utf8"));
const canonical = new Map([
  [1120, ["congressman / congresswoman", "congressman/congresswoman"]],
  [1303, ["criterion / criteria", "criterion/criteria"]],
  [2415, ["greeting", "greeting(s)"]],
  [2449, ["gymnasium", "gymnasium/gym"]],
  [2886, ["it", "it (its, itself)"]],
  [2924, ["judgment", "judgment/judgement"]],
  [2977, ["laboratory", "laboratory/lab"]],
  [3996, ["pm", "pm/p.m."]],
  [4010, ["policeman", "policeman/cop"]],
  [4700, ["seagull", "seagull/gull"]],
  [5219, ["subway / underground / metro", "subway/underground/ metro"]],
  [5994, ["you", "you (your, yours, yourself, yourselves)"]],
]);

const byId = new Map(words.map((word) => [word.id, word]));
for (const [wordId, [previous, official]] of canonical) {
  const word = byId.get(wordId);
  if (!word) throw new Error(`Missing word_id ${wordId}`);
  if (word.word !== previous && word.word !== official) throw new Error(`Unexpected headword for ${wordId}: ${word.word}`);
  word.word = official;
}

fs.writeFileSync(file, JSON.stringify(words), "utf8");
console.log(`Updated ${canonical.size} official merged headwords without changing word_id or order.`);
