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

const fixedComponentGlosses: Record<string, string> = {
  "-alis": "形容詞字尾",
};

function componentKey(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US").replace(/[.'’]/g, "");
}

function isCautionaryClause(value: string) {
  return /(?:不是|不能|不等於|不可|不宜|無可證|僅供|僅可|可聯想|有助辨識|教學分析|假說|推測|可能|不確定|爭議)/.test(value);
}

function quotedGlosses(record: EtymologyRecord) {
  const glosses = new Map<string, string>();
  const pattern = /(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?)\s*(?:『([^』]+)』|「([^」]+)」|“([^”]+)”|"([^"]+)"|'([^']+)')/gu;
  for (const source of [record.etymon, record.historicalComponents, record.modernSegmentation]) {
    for (const clause of source.split(/[。；;]/)) {
      if (isCautionaryClause(clause)) continue;
      for (const match of clause.matchAll(pattern)) {
        const gloss = match.slice(2).find(Boolean)?.trim();
        if (gloss && /\p{Script=Han}/u.test(gloss)) glosses.set(componentKey(match[1]), gloss);
      }
    }
  }
  return glosses;
}

function isPlainGloss(value: string) {
  return value.length <= 36 && !/[+＋]/.test(value);
}

function compactBreakdown(record: EtymologyRecord) {
  return `${record.headword}（不宜拆分）`;
}

function findComponentGloss(component: string, glosses: Map<string, string>) {
  const key = componentKey(component);
  const quoted = glosses.get(key);
  if (quoted && isPlainGloss(quoted)) return quoted;
  return fixedComponentGlosses[key];
}

function plusComponents(record: EtymologyRecord) {
  const sources = [record.historicalComponents, record.modernSegmentation, record.etymon];
  const expression = /(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?\s*[+＋]\s*-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?(?:\s*[+＋]\s*-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?)*)/u;
  for (const source of sources) {
    for (const clause of source.split(/[。；;]/)) {
      if (isCautionaryClause(clause)) continue;
      const match = clause.match(expression);
      if (match) return match[1].split(/[+＋]/).map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
}

export function simpleBreakdownFor(record: EtymologyRecord) {
  const components = plusComponents(record);
  if (components.length > 1) {
    const glosses = quotedGlosses(record);
    const explained = components.map((component) => {
      const gloss = findComponentGloss(component, glosses);
      return gloss ? `${component}（${gloss}）` : null;
    });
    if (explained.some((component) => component === null)) return compactBreakdown(record);
    const result = explained.join("＋");
    return result.length <= 60 ? result : compactBreakdown(record);
  }

  const modernPair = record.modernSegmentation.match(/(-?[\p{Script=Latin}*][\p{Script=Latin}\p{M}*.'’/-]*-?).{0,12}『([^』]+)』/u);
  if (modernPair && isPlainGloss(modernPair[2])) {
    const result = `${modernPair[1]}（${modernPair[2]}）`;
    return result.length <= 60 ? result : compactBreakdown(record);
  }

  const simpleClause = record.modernSegmentation.split(/[；。]/).find((clause) =>
    clause.trim() && !/(?:不能|不是|不等於|不可|不宜|無可證|歷史構詞|有助辨識)/.test(clause),
  )?.trim();
  if (simpleClause) {
    if (/[+＋]/.test(simpleClause)) return compactBreakdown(record);
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
