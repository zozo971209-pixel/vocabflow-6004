export type ReviewRecord = { due: string; last: string; streak: number; mistakes: number };
export type ReviewMap = Record<number, ReviewRecord>;

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function scheduleReview(previous: ReviewRecord | undefined, correct: boolean, now = new Date()): ReviewRecord {
  // Repeated correct attempts on the same day are practice, not spaced recall.
  if (correct && previous?.last && previous.streak > 0 && localDate(new Date(previous.last)) === localDate(now)) return previous;
  const streak = correct ? (previous?.streak ?? 0) + 1 : 0;
  const days = correct ? [1, 3, 7, 14, 30, 60][Math.min(streak - 1, 5)] : 1;
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return { due: localDate(next), last: now.toISOString(), streak, mistakes: (previous?.mistakes ?? 0) + (correct ? 0 : 1) };
}

export function dueReviewIds(records: ReviewMap, today = localDate()) {
  return Object.entries(records).filter(([, item]) => item.due <= today)
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || b[1].mistakes - a[1].mistakes)
    .map(([id]) => Number(id));
}
