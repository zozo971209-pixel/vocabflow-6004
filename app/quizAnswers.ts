export function normalizeFillAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/[./]/g, " ")
    .replace(/^[\s!?！？，,。;；:：]+|[\s!?！？，,。;；:：]+$/g, "")
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
  const stripParticle = (value: string) => value.length > 2 ? value.replace(/[的地]$/, "") : value;
  return acceptedChineseAnswers(meaning).some((answer) => answer === normalized || stripParticle(answer) === stripParticle(normalized));
}

export function fillAnswerFeedback(input: string, headword: string, direction: "en-to-zh" | "zh-to-en") {
  if (direction === "en-to-zh") return "意思未符合收錄詞義；填其中一個完整中文意思即可，不必填全部。";
  const answer = normalizeFillAnswer(input);
  const accepted = acceptedFillAnswers(headword);
  if (accepted.some(base => [`${base}s`, `${base}es`, `${base}ed`, `${base}ing`, `${base.replace(/e$/, "")}ing`].includes(answer))) {
    return "詞形不同：此題請填詞條所列形式。";
  }
  const near = accepted.some(base => {
    if (Math.abs(base.length - answer.length) > 1) return false;
    if (base.length === answer.length) return [...base].filter((char, i) => char !== answer[i]).length <= 2;
    const [shorter, longer] = base.length < answer.length ? [base, answer] : [answer, base];
    return [...longer].some((_, i) => longer.slice(0, i) + longer.slice(i + 1) === shorter);
  });
  return near ? "拼字可能有誤：請對照正確答案的字母。" : "填入的英文不符合這個詞條，請對照詞義與正確答案。";
}
