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
