import type { QuizHistoryEntry } from "./QuizModal";

export type QuizMistakeRecord = {
  correctStreak: number;
  lastWrongAt: string;
};

export type QuizMistakeMap = Record<number, QuizMistakeRecord>;

export function updateQuizMistakes(current: QuizMistakeMap, entry: QuizHistoryEntry): QuizMistakeMap {
  const next = { ...current };
  const wrongIds = new Set(entry.wrongWordIds);
  const testedIds = entry.testedWordIds ?? entry.wrongWordIds;

  for (const id of testedIds) {
    if (wrongIds.has(id)) {
      next[id] = { correctStreak: 0, lastWrongAt: entry.completedAt };
      continue;
    }

    const existing = next[id];
    if (!existing) continue;
    const correctStreak = existing.correctStreak + 1;
    if (correctStreak >= 3) delete next[id];
    else next[id] = { ...existing, correctStreak };
  }

  return next;
}

export function deriveQuizMistakes(history: QuizHistoryEntry[]): QuizMistakeMap {
  return [...history]
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    .reduce(updateQuizMistakes, {} as QuizMistakeMap);
}

export function isQuizMistakeMap(value: unknown, validIds?: Set<number>): value is QuizMistakeMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, record]) => {
    const id = Number(key);
    if (!Number.isInteger(id) || (validIds && !validIds.has(id)) || !record || typeof record !== "object" || Array.isArray(record)) return false;
    const item = record as Partial<QuizMistakeRecord>;
    return Number.isInteger(item.correctStreak) && Number(item.correctStreak) >= 0 && Number(item.correctStreak) < 3 &&
      typeof item.lastWrongAt === "string" && Number.isFinite(Date.parse(item.lastWrongAt));
  });
}
