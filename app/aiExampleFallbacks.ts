export type AiDraftExample = {
  en: string;
  zh: string;
  enStart: number;
  enEnd: number;
  zhStart: number;
  zhEnd: number;
  targetEn: string;
  targetZh: string;
  senseZh: string;
  pos: string;
  qualityScore: number;
  origin: "ai-generated";
  sourceType: "ai-draft";
  reviewStatus: "ai-draft";
};

export type AiDraftExamplePayload = {
  schemaVersion: 1;
  notice: string;
  source: { title: string; url: string; license: string; licenseUrl: string };
  stats: { totalWords: number; wordsWithExamples: number; totalExamples: number; aiGeneratedExamples: number; sourceBackedWords: number };
  words: Record<string, AiDraftExample[]>;
};

export function isAiDraftExamplePayload(value: unknown): value is AiDraftExamplePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<AiDraftExamplePayload>;
  return payload.schemaVersion === 1 && typeof payload.notice === "string" &&
    Boolean(payload.words) && typeof payload.words === "object";
}
