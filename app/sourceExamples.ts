export type SourceExample = {
  en: string;
  targetEn: string;
  exampleKind: "sentence" | "usage-fragment";
  sourceType: "open-wordnet";
  sourceTitle: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  reviewStatus: "source-backed";
};

export type SourceExamplePayload = {
  schemaVersion: 1;
  notice: string;
  source: { title: string; url: string; license: string; licenseUrl: string };
  stats: { totalWords: number; wordsWithExamples: number; totalExamples: number };
  words: Record<string, SourceExample[]>;
};

export function isSourceExamplePayload(value: unknown): value is SourceExamplePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SourceExamplePayload>;
  return payload.schemaVersion === 1 && typeof payload.notice === "string" &&
    Boolean(payload.source) && typeof payload.source?.url === "string" &&
    Boolean(payload.words) && typeof payload.words === "object";
}
