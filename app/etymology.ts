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
