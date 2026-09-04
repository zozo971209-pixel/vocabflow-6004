import fs from "node:fs";
import path from "node:path";

const wordnetDir = process.argv[2];
if (!wordnetDir) throw new Error("Usage: node scripts/build-ai-enrichment.mjs <open-english-wordnet-json-directory>");

const projectRoot = process.cwd();
const vocab = JSON.parse(fs.readFileSync(path.join(projectRoot, "public", "vocab.json"), "utf8"));
const entries = {};
const synsets = {};

for (const filename of fs.readdirSync(wordnetDir)) {
  if (!filename.endsWith(".json")) continue;
  const fullPath = path.join(wordnetDir, filename);
  if (filename.startsWith("entries-")) Object.assign(entries, JSON.parse(fs.readFileSync(fullPath, "utf8")));
  if (/^(noun|verb|adj|adv)\./.test(filename)) Object.assign(synsets, JSON.parse(fs.readFileSync(fullPath, "utf8")));
}

const normalize = (value) => String(value ?? "").toLowerCase().replace(/[’']/g, "'").replace(/_/g, " ").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
const display = (value) => value.replace(/_/g, " ");
const unique = (values, limit = 8) => [...new Set(values.map((value) => display(String(value)).trim()).filter(Boolean))].slice(0, limit);

function candidatesFor(rawWord) {
  const base = rawWord
    .replace(/\([^)]*\)/g, "")
    .replace(/[.]/g, "")
    .trim();
  const slashParts = base.split("/").map((part) => part.trim()).filter(Boolean);
  const candidates = [rawWord, base, ...slashParts];
  return unique(candidates.flatMap((candidate) => [
    candidate,
    candidate.replace(/-/g, "_"),
    candidate.replace(/\s+/g, "_"),
    candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  ]), 12).map((candidate) => candidate.toLowerCase());
}

function findEntry(rawWord) {
  for (const candidate of candidatesFor(rawWord)) {
    if (entries[candidate]) return { key: candidate, entry: entries[candidate] };
  }
  return null;
}

function lemmaFromSenseId(id) {
  return id ? display(id.split("%")[0]) : "";
}

function exampleUsesTarget(example, targets) {
  const normalizedExample = normalize(example);
  return targets.some((targetValue) => {
    const target = normalize(targetValue);
    if (!target) return false;
    if (target.includes(" ")) return normalizedExample.includes(target);
    const variants = new Set([target, `${target}s`, `${target}es`, `${target}ed`, `${target}ing`]);
    if (target.endsWith("e")) variants.add(`${target.slice(0, -1)}ing`);
    if (target.endsWith("y")) {
      variants.add(`${target.slice(0, -1)}ies`);
      variants.add(`${target.slice(0, -1)}ied`);
    }
    return normalizedExample.split(" ").some((token) => variants.has(token));
  });
}

function primaryMeaning(meaning) {
  return String(meaning)
    .split(/\n|\\n/)[0]
    .replace(/^\s*(?:n|v|a|adj|adv|prep|pron|conj|art|num)\.\s*/i, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
}

const words = {};
let matchedWords = 0;
let wordsWithExamples = 0;
let wordsWithSynonyms = 0;

for (const item of vocab) {
  const found = findEntry(item.word);
  const targetForms = candidatesFor(item.word).map(display);
  const data = {
    definitions: [],
    family: [],
    forms: [],
    collocations: [],
    phrases: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    usage: [],
  };
  let nounForms = [];

  if (found) {
    matchedWords += 1;
    const posEntries = Object.values(found.entry);
    nounForms = found.entry.n?.form ?? [];
    const senses = posEntries.flatMap((posEntry) => posEntry.sense ?? []);
    const relatedSynsets = senses.map((sense) => synsets[sense.synset]).filter(Boolean);
    const examples = unique(senses.flatMap((sense) => sense.sent ?? []).concat(relatedSynsets.flatMap((synset) => synset.example ?? []))
      .filter((example) => exampleUsesTarget(example, [...targetForms, ...posEntries.flatMap((posEntry) => posEntry.form ?? [])])), 3);
    const synonyms = unique(relatedSynsets.flatMap((synset) => synset.members ?? []).filter((member) => !targetForms.some((target) => normalize(member) === normalize(target))), 8);
    const phrases = unique(relatedSynsets.flatMap((synset) => synset.members ?? []).filter((member) => /[_ -]/.test(member) && member.split(/[_ -]/).length > 1), 6);
    const forms = unique(posEntries.flatMap((posEntry) => posEntry.form ?? []).filter((form) => !targetForms.some((target) => normalize(form) === normalize(target))), 8);
    const family = unique(senses.flatMap((sense) => sense.derivation ?? []).map(lemmaFromSenseId).filter((lemma) => !targetForms.some((target) => normalize(lemma) === normalize(target))), 8);
    const antonyms = unique(senses.flatMap((sense) => sense.antonym ?? []).map(lemmaFromSenseId), 8);
    const definitions = unique(relatedSynsets.flatMap((synset) => synset.definition ?? []), 2);
    const collocations = unique(examples, 3);

    data.definitions = definitions;
    data.family = family;
    data.forms = forms;
    data.collocations = collocations;
    data.phrases = phrases;
    data.examples = examples.map((en) => ({ en, zhHint: primaryMeaning(item.meaning) }));
    data.synonyms = synonyms;
    data.antonyms = antonyms;
    if (examples.length) wordsWithExamples += 1;
    if (synonyms.length) wordsWithSynonyms += 1;
  }

  if (item.word.toLowerCase() === "a/an") {
    data.definitions = ["indefinite articles used before singular countable nouns"];
    data.collocations = ["a book", "an apple"];
    data.examples = [
      { en: "I saw a dog in the park.", zhHint: "我在公園看到一隻狗。" },
      { en: "She ate an apple.", zhHint: "她吃了一顆蘋果。" },
    ];
    data.synonyms = [];
    data.phrases = [];
  }

  const isNoun = /(?:^|\/)n\./i.test(item.pos);
  if (item.word.toLowerCase() === "a/an") {
    data.usage = ["a 用在子音音素前；an 用在母音音素前，判斷依發音而不是拼字。"];
  } else if (isNoun) {
    const pluralForms = unique(nounForms.filter((form) => typeof form === "string" && normalize(form) !== normalize(item.word)), 6);
    data.usage = pluralForms.length
      ? [`可能有可數用法；詞形資料收錄：${pluralForms.join("、")}`, "實際可數性仍會隨詞義與語境改變。"]
      : ["可數性可能隨詞義與語境改變；Open English WordNet 未直接標註可數／不可數。"];
  } else {
    data.usage = [`主要詞性：${item.pos || "未標示"}；可數／不可數只適用名詞用法。`];
  }

  words[item.id] = data;
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  generatedBy: "AI-assisted deterministic extraction",
  notice: "延伸內容由 AI 與程式依詞典資料自動整理，未經人工逐筆核對，可能有錯漏。",
  source: {
    title: "Open English WordNet 2025",
    url: "https://en-word.net/",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  stats: { totalWords: vocab.length, matchedWords, wordsWithExamples, wordsWithSynonyms },
  words,
};

fs.writeFileSync(path.join(projectRoot, "public", "enrichment-ai.json"), `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ ...payload.stats, bytes: fs.statSync(path.join(projectRoot, "public", "enrichment-ai.json")).size }));
