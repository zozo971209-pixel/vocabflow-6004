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
  /** Provenance is explicit so source-backed examples are never presented as dictionary copy. */
  sourceType?: "tatoeba" | "ai-draft" | "open-wordnet" | "licensed-dictionary";
  sourceTitle?: string;
  sourceUrl?: string;
  sourceLicense?: string;
  sourceLicenseUrl?: string;
  reviewStatus?: "source-backed" | "ai-draft" | "needs-review";
  englishSentenceId?: number;
  chineseSentenceId?: number;
};

export type BilingualExamplePayload = {
  schemaVersion: 2;
  notice: string;
  source: { title: string; url: string; license: string; licenseUrl: string };
  stats: { totalWords: number; wordsWithExamples: number; totalExamples: number; corpusExamples?: number; aiGeneratedExamples?: number; sourceBackedWords?: number; draftExamplesArchived?: number };
  words: Record<string, BilingualExample[]>;
};

export function isBilingualExamplePayload(value: unknown): value is BilingualExamplePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<BilingualExamplePayload>;
  return payload.schemaVersion === 2 && typeof payload.notice === "string" &&
    Boolean(payload.source) && typeof payload.source?.url === "string" &&
    Boolean(payload.words) && typeof payload.words === "object";
}
