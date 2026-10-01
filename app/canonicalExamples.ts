export type CanonicalExample = {
  senseId: string;
  pos: string;
  meaning: string;
  explanation: string;
  definition: string;
  usageLabel: string;
  countability: string;
  transitivity: string;
  register: string;
  priority: string;
  primary: boolean;
  en: string;
  zh: string;
  targetForms: string[];
};

export type CanonicalExamplePayload = {
  schemaVersion: 1;
  generatedAt: string;
  sourceSpreadsheetId: string;
  words: Record<string, CanonicalExample[]>;
};

export function isCanonicalExamplePayload(value: unknown): value is CanonicalExamplePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CanonicalExamplePayload>;
  return payload.schemaVersion === 1 &&
    typeof payload.sourceSpreadsheetId === "string" &&
    Boolean(payload.words) && typeof payload.words === "object";
}
