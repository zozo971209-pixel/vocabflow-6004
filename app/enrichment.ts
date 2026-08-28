export type EnrichmentCategory =
  | "word_family"
  | "irregular_form"
  | "collocation"
  | "fixed_phrase"
  | "example"
  | "synonym"
  | "antonym"
  | "countability";

export type VerifiedEnrichmentRecord = {
  recordId: string;
  wordId: number;
  headword: string;
  category: EnrichmentCategory;
  senseZh: string;
  contentEn: string;
  contentZh: string;
  exampleEn: string;
  exampleZh: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceLocation: string;
  sourceLicense: string;
  reviewer: string;
  verifiedAt: string;
  verificationStatus: "human_verified";
};

const categories: EnrichmentCategory[] = ["word_family", "irregular_form", "collocation", "fixed_phrase", "example", "synonym", "antonym", "countability"];

export function isVerifiedEnrichmentRecord(value: unknown): value is VerifiedEnrichmentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<VerifiedEnrichmentRecord>;
  const hasContent = record.category === "example"
    ? typeof record.exampleEn === "string" && record.exampleEn.length > 0 && typeof record.exampleZh === "string" && record.exampleZh.length > 0
    : typeof record.contentEn === "string" && record.contentEn.length > 0 && typeof record.contentZh === "string" && record.contentZh.length > 0;
  return hasContent && Number.isFinite(record.wordId) &&
    typeof record.recordId === "string" && record.recordId.length > 0 &&
    typeof record.headword === "string" && record.headword.length > 0 &&
    typeof record.category === "string" && categories.includes(record.category as EnrichmentCategory) &&
    typeof record.senseZh === "string" && record.senseZh.length > 0 &&
    typeof record.sourceTitle === "string" && record.sourceTitle.length > 0 &&
    typeof record.sourceUrl === "string" && /^https?:\/\//i.test(record.sourceUrl) &&
    typeof record.sourceLocation === "string" && record.sourceLocation.length > 0 &&
    typeof record.sourceLicense === "string" && record.sourceLicense.length > 0 &&
    typeof record.reviewer === "string" && record.reviewer.length > 0 &&
    typeof record.verifiedAt === "string" && record.verifiedAt.length > 0 &&
    record.verificationStatus === "human_verified";
}
