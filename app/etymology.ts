export type EtymologySource = {
  label: string;
  url: string;
};

export type EtymologyRecord = {
  wordId: number;
  headword: string;
  etymon: string;
  modernSegmentation: string;
  historicalComponents: string;
  languageRoute: string;
  developmentZh: string;
  learningNoteZh: string;
  caveatZh: string;
  relatedForms: string[];
  sources: EtymologySource[];
  sourceCount: number;
  hasUncertainty: boolean;
};

export type EtymologyPayload = {
  schemaVersion: 1;
  generatedAt: string;
  sourceSpreadsheetId: string;
  recordCount: number;
  records: Record<string, EtymologyRecord>;
};

const componentGlosses: Record<string, string> = {
  "-al": "形容詞字尾", "-alis": "形容詞字尾", "-ial": "形容詞字尾", "-ic": "形容詞字尾",
  "-ical": "形容詞字尾", "-ous": "形容詞字尾", "-ive": "形容詞字尾", "-ful": "充滿……的",
  "-less": "沒有……的", "-able": "能……的", "-ible": "能……的", "-ly": "副詞字尾",
  "-ity": "名詞字尾", "-ty": "名詞字尾", "-ness": "名詞字尾", "-tion": "名詞字尾",
  "-sion": "名詞字尾", "-ment": "名詞字尾", "-ance": "名詞字尾", "-ence": "名詞字尾",
  "-er": "人或事物", "-or": "人或事物", "-ist": "從事者", "-ster": "某類人",
  "-ize": "使成為", "-ise": "使成為", "-ify": "使成為", "-en": "使成為",
  "prae": "在前", "pre": "在前", "pre-": "在前", "re": "再、回", "re-": "再、回",
  "un": "不、相反", "un-": "不、相反", "dis": "分開、不", "dis-": "分開、不",
  "mis": "錯誤", "mis-": "錯誤", "sub": "在下", "sub-": "在下", "inter": "在……之間",
  "inter-": "在……之間", "trans": "跨越", "trans-": "跨越", "anti": "反對", "anti-": "反對",
};

function componentKey(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US").replace(/[.'’]/g, "");
}

function quotedGlosses(record: EtymologyRecord) {
  const glosses = new Map<string, string>();
  const text = [record.etymon, record.modernSegmentation, record.historicalComponents].join("；");
  const pattern = /(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?)\s*(?:『([^』]+)』|「([^」]+)」|“([^”]+)”|"([^"]+)"|'([^']+)')/gu;
  for (const match of text.matchAll(pattern)) {
    const gloss = match.slice(2).find(Boolean)?.trim();
    if (gloss && /\p{Script=Han}/u.test(gloss)) glosses.set(componentKey(match[1]), gloss);
  }
  return glosses;
}

function commonPrefixLength(left: string, right: string) {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
  return length;
}

function compactBreakdown(record: EtymologyRecord, glosses = quotedGlosses(record)) {
  const noteGloss = record.learningNoteZh.match(/[『「]([^』」]{1,36})[』」]/)?.[1];
  if (noteGloss && !/(?:Latin|Greek|French|Old English|Middle English|歷史|整詞|傳入|來源)/i.test(noteGloss)) {
    return `${record.headword}（${noteGloss}）`;
  }

  const headwordKey = componentKey(record.headword.split(/[\s(/]/)[0]);
  const candidates = [...glosses.entries()].filter(([, gloss]) => gloss.length <= 36);
  candidates.sort(([leftKey, leftGloss], [rightKey, rightGloss]) => {
    const scoreDifference = commonPrefixLength(rightKey, headwordKey) - commonPrefixLength(leftKey, headwordKey);
    return scoreDifference || leftGloss.length - rightGloss.length;
  });
  if (candidates[0]) return `${record.headword}（${candidates[0][1]}）`;
  return `${record.headword}（整體借入或不適合再拆）`;
}

function findComponentGloss(component: string, glosses: Map<string, string>) {
  const key = componentKey(component);
  if (componentGlosses[key]) return componentGlosses[key];
  if (glosses.has(key)) return glosses.get(key);
  const near = [...glosses.entries()].find(([candidate]) => candidate.startsWith(key) || key.startsWith(candidate));
  return near?.[1];
}

function plusComponents(record: EtymologyRecord) {
  const sources = [record.historicalComponents, record.modernSegmentation, record.etymon];
  const expression = /(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?\s*[+＋]\s*-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?(?:\s*[+＋]\s*-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?)*)/u;
  for (const source of sources) {
    const match = source.match(expression);
    if (match) return match[1].split(/[+＋]/).map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

export function simpleBreakdownFor(record: EtymologyRecord) {
  const components = plusComponents(record);
  if (components.length > 1) {
    const glosses = quotedGlosses(record);
    const explained = components.map((component) => {
      const gloss = findComponentGloss(component, glosses);
      return gloss ? `${component}（${gloss}）` : component;
    });
    const result = explained.join("＋");
    return result.length <= 60 ? result : compactBreakdown(record, glosses);
  }

  const modernPair = record.modernSegmentation.match(/(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?).{0,12}『([^』]+)』/u);
  if (modernPair) {
    const result = `${modernPair[1]}（${modernPair[2]}）`;
    return result.length <= 60 ? result : compactBreakdown(record);
  }

  const simpleClause = record.modernSegmentation.split(/[；。]/).find((clause) =>
    clause.trim() && !/(?:不能|不是|不等於|不可|不宜|無可證|歷史構詞|有助辨識)/.test(clause),
  )?.trim();
  if (simpleClause) {
    const cleaned = simpleClause.replace(/『([^』]+)』/g, "（$1）");
    if (!/\p{Script=Latin}/u.test(cleaned)) {
      const result = `${record.headword}（${cleaned.replace(/^它們是?/, "")}）`;
      if (result.length <= 60) return result;
    }
    const directMeaning = cleaned.match(/^(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?)\s+(\p{Script=Han}[^，；。]{1,36})$/u);
    if (directMeaning && !/(?:Latin|Greek|French|Old English|Middle English|歷史|整詞|傳入|來源)/i.test(directMeaning[2])) {
      return `${directMeaning[1]}（${directMeaning[2]}）`;
    }
    return compactBreakdown(record);
  }

  if (/(?:擬聲|模擬)/.test(record.modernSegmentation)) return `${record.headword}（擬聲形成）`;
  return compactBreakdown(record);
}

function isSource(value: unknown): value is EtymologySource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<EtymologySource>;
  return typeof source.label === "string" && /^https:\/\//.test(source.url ?? "");
}

export function isEtymologyRecord(value: unknown): value is EtymologyRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EtymologyRecord>;
  return Number.isInteger(record.wordId) &&
    typeof record.headword === "string" &&
    typeof record.etymon === "string" &&
    typeof record.modernSegmentation === "string" &&
    typeof record.historicalComponents === "string" &&
    typeof record.languageRoute === "string" &&
    typeof record.developmentZh === "string" &&
    typeof record.learningNoteZh === "string" &&
    typeof record.caveatZh === "string" &&
    Array.isArray(record.relatedForms) && record.relatedForms.every((item) => typeof item === "string") &&
    Array.isArray(record.sources) && record.sources.length > 0 && record.sources.every(isSource) &&
    Number.isInteger(record.sourceCount) &&
    typeof record.hasUncertainty === "boolean";
}

export function isEtymologyPayload(value: unknown): value is EtymologyPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<EtymologyPayload>;
  if (payload.schemaVersion !== 1 || payload.recordCount !== 6004 || !payload.records || typeof payload.records !== "object") return false;
  const entries = Object.entries(payload.records);
  return entries.length === 6004 && entries.every(([key, record]) => Number(key) === record.wordId && isEtymologyRecord(record));
}
