export type AiExample = { en: string; zhHint: string };

export type AiEnrichmentWord = {
  definitions: string[];
  family: string[];
  forms: string[];
  collocations: string[];
  sentencePatterns?: string[];
  phrases: string[];
  examples: AiExample[];
  synonyms: string[];
  antonyms: string[];
  usage: string[];
  glosses?: Record<string, string>;
  synonymNotes?: Record<string, string>;
};

export type AiEnrichmentPayload = {
  schemaVersion: 1 | 2;
  notice: string;
  source: { title: string; url: string; license: string; licenseUrl: string };
  words: Record<string, AiEnrichmentWord>;
  glosses?: Record<string, string>;
};

export function isAiEnrichmentPayload(value: unknown): value is AiEnrichmentPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<AiEnrichmentPayload>;
  return (payload.schemaVersion === 1 || payload.schemaVersion === 2) && Boolean(payload.words) && typeof payload.words === "object" &&
    typeof payload.notice === "string" && Boolean(payload.source) && typeof payload.source?.url === "string";
}
