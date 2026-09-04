export type BilingualExample = {
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
  origin?: "tatoeba" | "ai-generated";
  englishSentenceId?: number;
  chineseSentenceId?: number;
};

export type BilingualExamplePayload = {
  schemaVersion: 2;
  notice: string;
  source: { title: string; url: string; license: string; licenseUrl: string };
  stats: { totalWords: number; wordsWithExamples: number; totalExamples: number; corpusExamples?: number; aiGeneratedExamples?: number };
  words: Record<string, BilingualExample[]>;
};

export function isBilingualExamplePayload(value: unknown): value is BilingualExamplePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<BilingualExamplePayload>;
  return payload.schemaVersion === 2 && typeof payload.notice === "string" &&
    Boolean(payload.source) && typeof payload.source?.url === "string" &&
    Boolean(payload.words) && typeof payload.words === "object";
}
