export function normalizeFillAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/[./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function acceptedFillAnswers(headword: string) {
  const results = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeFillAnswer(value);
    if (normalized) results.add(normalized);
  };
  const expand = (value: string) => {
    const trimmed = value.trim();
    add(trimmed);
    const match = trimmed.match(/^(.*?)\(([^)]+)\)(.*)$/);
    if (!match) return;
    const [, before, inside, after] = match;
    add(`${before}${after}`);
    if (inside.includes(",")) {
      inside.split(",").forEach((item) => add(item));
    } else {
      add(`${before}${inside}${after}`);
    }
  };
  headword.split("/").forEach(expand);
  expand(headword);
  return [...results];
}

export function isFillAnswerCorrect(input: string, headword: string) {
  return acceptedFillAnswers(headword).includes(normalizeFillAnswer(input));
}

export function normalizeChineseAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。；;、,.!?！？（）()\[\]「」『』：:]/g, "")
    .trim();
}

export function acceptedChineseAnswers(meaning: string) {
  const parts = meaning
    .replace(/\\n/g, "\n")
    .replace(/\[[^\]]+]/g, " ")
    .replace(/\([^)]{1,24}\)/g, " ")
    .replace(/\b(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gi, " ")
    .split(/[\n；;，,、/|]+/)
    .map((part) => normalizeChineseAnswer(part))
    .filter(Boolean);
  return [...new Set(parts)];
}

export function isChineseMeaningCorrect(input: string, meaning: string) {
  const normalized = normalizeChineseAnswer(input);
  if (!normalized) return false;
  return acceptedChineseAnswers(meaning).some((answer) => (
    answer === normalized || (normalized.length >= 2 && answer.startsWith(normalized))
  ));
}
