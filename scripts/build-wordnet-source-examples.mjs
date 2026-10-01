import fs from "node:fs";

const root = process.cwd();
const vocab = JSON.parse(fs.readFileSync(`${root}/public/vocab.json`, "utf8"));
const enrichment = JSON.parse(fs.readFileSync(`${root}/public/enrichment-ai.json`, "utf8"));
const outputPath = `${root}/public/source-examples.json`;

const NOISY_RE = /https?:\/\/|www\.|[{}<>]|\.{3,}|\|/i;
const PLACEHOLDER_NAMES = /\b(?:sam|sue|tom|mary|bob|alice|mick|bill|john|jane)\b/i;
const TOKEN_RE = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;
const REJECT_PATTERNS = [
  /\baccordance to\b/i,
  /\bthe accordance of\b/i,
  /\b(?:a|an) potential problem\b/i,
  /\bthe liquids, light, and gases absorb\b/i,
  /\bthey write them the information\b/i,
];
const AUXILIARIES = new Set("am is are was were be been being have has had do does did can could will would may might must should".split(" "));
const IRREGULAR_VERBS = new Set("ate became began bought brought built came chose did drank drove fell felt found gave got went grew heard kept knew left lost made met paid put read ran said saw sent set slept spoke spent stood took taught told thought threw understood wore won wrote".split(" "));

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[’']/g, "'").replace(/_/g, " ").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
}

function candidates(word, data) {
  return [...new Set([word.word, ...(data.forms ?? [])]
    .flatMap((value) => String(value).replace(/\([^)]*\)/g, "").replace(/\./g, "").split(/[\/]/))
    .map((value) => normalize(value))
    .filter((value) => value && !value.includes(" ")))];
}

function usesTarget(sentence, targets) {
  const value = normalize(sentence);
  return targets.some((target) => {
    if (target.includes(" ")) return value.includes(target);
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}(?:s|es|ed|ing|ies|ied|en|er|est)?([^a-z]|$)`, "i").test(value);
  });
}

function targetMatch(sentence, targets) {
  for (const target of targets) {
    if (target.includes(" ")) {
      const start = normalize(sentence).indexOf(target);
      if (start >= 0) return sentence.slice(start, start + target.length);
      continue;
    }
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(^|[^a-z])(${escaped}(?:s|es|ed|ing|ies|ied|en|er|est)?)(?=[^a-z]|$)`, "i").exec(sentence);
    if (match) return match[2];
    const compact = target.replace(/[^a-z]/g, "");
    if (compact.length > 1) {
      const flexible = compact.split("").map((letter) => letter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[.\\s-]*");
      const abbreviated = new RegExp(`(^|[^a-z])(${flexible})(?=[^a-z]|$)`, "i").exec(sentence);
      if (abbreviated) return abbreviated[2];
    }
  }
  return "";
}

function score(sentence, targets) {
  const tokens = sentence.match(TOKEN_RE) ?? [];
  let value = 0;
  if (/^[A-Z“‘"']/.test(sentence)) value += 15;
  if (/[.!?]$/.test(sentence)) value += 25;
  if (tokens.length >= 5 && tokens.length <= 18) value += 20;
  if (sentence.length >= 30 && sentence.length <= 140) value += 15;
  if (usesTarget(sentence, targets)) value += 35;
  if (PLACEHOLDER_NAMES.test(sentence)) value -= 18;
  if (sentence.includes("‘") || sentence.includes("’")) value += 2;
  return value;
}

function exampleKind(sentence) {
  const tokens = sentence.match(TOKEN_RE) ?? [];
  const hasSubject = /^(?:i|you|he|she|it|we|they|someone|something|this|that|these|those|the|a|an)\b/i.test(sentence.trim());
  const hasFiniteVerb = tokens.some((token) => AUXILIARIES.has(token.toLowerCase()) || IRREGULAR_VERBS.has(token.toLowerCase()) || /(?:ed|ing|ies|ied)$/.test(token.toLowerCase()));
  const startsWithCapital = /^[A-Z]/.test(sentence.trim());
  return /[.!?]$/.test(sentence) || (startsWithCapital && tokens.length >= 4) || (hasSubject && hasFiniteVerb && tokens.length >= 4) ? "sentence" : "usage-fragment";
}

const words = {};
let totalExamples = 0;
for (const word of vocab) {
  const data = enrichment.words?.[String(word.id)];
  if (!data?.examples?.length) continue;
  const targets = candidates(word, data);
  const ranked = data.examples
    .map((example) => String(example?.en ?? "").replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 180)
    .filter((sentence) => (sentence.match(TOKEN_RE) ?? []).length >= 3)
    .filter((sentence) => !NOISY_RE.test(sentence))
    .filter((sentence) => !PLACEHOLDER_NAMES.test(sentence))
    .filter((sentence) => !REJECT_PATTERNS.some((pattern) => pattern.test(sentence)))
    .filter((sentence) => usesTarget(sentence, targets))
    // Wordnet includes both complete examples and concise dictionary phrases;
    // keep clean target-containing records and label their kind below.
    .map((sentence) => ({ sentence, target: targetMatch(sentence, targets), score: score(sentence, targets) }))
    .sort((left, right) => right.score - left.score || left.sentence.length - right.sentence.length);

  const chosen = [];
  const seen = new Set();
  for (const item of ranked) {
    const key = normalize(item.sentence);
    if (seen.has(key)) continue;
    // Avoid two nearly identical inflection examples for the same word.
    if (chosen.some((entry) => {
      const prior = new Set(entry.en.toLowerCase().split(/\s+/));
      const current = new Set(item.sentence.toLowerCase().split(/\s+/));
      let overlap = 0;
      for (const token of current) if (prior.has(token)) overlap += 1;
      return overlap / Math.max(1, current.size) > 0.82;
    })) continue;
    seen.add(key);
    chosen.push({
      en: item.sentence,
      targetEn: item.target,
      exampleKind: exampleKind(item.sentence),
      sourceType: "open-wordnet",
      sourceTitle: "Open English Wordnet 2025",
      sourceUrl: "https://en-word.net/",
      sourceLicense: "CC BY 4.0",
      sourceLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      reviewStatus: "source-backed",
    });
    if (chosen.length === 2) break;
  }
  if (chosen.length) {
    words[String(word.id)] = chosen;
    totalExamples += chosen.length;
  }
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  notice: "英文用例取自 Open English Wordnet 2025；本站保留來源與 CC BY 4.0 授權連結，並區分完整句與詞典用例片語。Wordnet 不保證提供中文翻譯，因此未把自動產生的翻譯冒充來源內容。",
  source: { title: "Open English Wordnet 2025", url: "https://en-word.net/", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
  stats: { totalWords: vocab.length, wordsWithExamples: Object.keys(words).length, totalExamples },
  words,
};
fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ ...payload.stats, bytes: fs.statSync(outputPath).size }));
