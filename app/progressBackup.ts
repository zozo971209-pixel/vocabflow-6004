import type { QuizHistoryEntry, QuizWordStatus } from "./QuizModal";
import type { ReviewMap } from "./reviewSchedule";

export type ProgressSnapshot = {
  statuses: Record<number, QuizWordStatus>;
  settings: { currentDay: number; startDate: string; speechSpeed: "normal" | "slow" | "ultraSlow"; speechSpeedVersion: number; theme: "light" | "dark"; fontSize: "small" | "normal" | "large" };
  quizHistory: QuizHistoryEntry[];
  notes: Record<number, string>;
  reviews: ReviewMap;
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const integer = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function parseProgressBackup(value: unknown, ids: Set<number>, totalDays: number): { exportedAt: string; progress: ProgressSnapshot } {
  const fail = (): never => { throw new Error("備份資料格式不正確；尚未變更任何紀錄。"); };
  if (!object(value) || value.format !== "vocabflow-progress" || value.version !== 1 || !object(value.progress)) return fail();
  const p = value.progress;
  if (!object(p.statuses) || !object(p.settings)) return fail();
  const statuses: ProgressSnapshot["statuses"] = {};
  for (const [key, status] of Object.entries(p.statuses)) {
    if (!ids.has(Number(key)) || !["known", "review", "unknown"].includes(String(status))) return fail();
    statuses[Number(key)] = status as QuizWordStatus;
  }
  const s = p.settings;
  if (!integer(s.currentDay, 1, totalDays) || !date(s.startDate) || !["normal", "slow", "ultraSlow"].includes(String(s.speechSpeed))) return fail();
  if (s.theme !== undefined && s.theme !== "light" && s.theme !== "dark") return fail();
  if (s.fontSize !== undefined && !["small", "normal", "large"].includes(String(s.fontSize))) return fail();
  const notes: ProgressSnapshot["notes"] = {};
  if (p.notes !== undefined) {
    if (!object(p.notes)) return fail();
    for (const [key, note] of Object.entries(p.notes)) {
      if (!ids.has(Number(key)) || typeof note !== "string" || note.length > 500) return fail();
      notes[Number(key)] = note;
    }
  }
  const history: QuizHistoryEntry[] = [];
  if (p.quizHistory !== undefined) {
    if (!Array.isArray(p.quizHistory) || p.quizHistory.length > 10000) return fail();
    for (const entry of p.quizHistory) {
      if (!object(entry) || typeof entry.id !== "string" || typeof entry.completedAt !== "string" || !Number.isFinite(Date.parse(entry.completedAt)) ||
        !integer(entry.startDay, 1, totalDays) || !integer(entry.endDay, entry.startDay, totalDays) || !integer(entry.total, 1, ids.size) || !integer(entry.correct, 0, entry.total) ||
        !Array.isArray(entry.wrongWordIds) || !entry.wrongWordIds.every(id => typeof id === "number" && ids.has(id)) || new Set(entry.wrongWordIds).size !== entry.wrongWordIds.length || entry.wrongWordIds.length !== entry.total - entry.correct) return fail();
      if (entry.testedWordIds !== undefined && (!Array.isArray(entry.testedWordIds) || entry.testedWordIds.length !== entry.total || new Set(entry.testedWordIds).size !== entry.total || !entry.testedWordIds.every(id => typeof id === "number" && ids.has(id)) || !entry.wrongWordIds.every(id => (entry.testedWordIds as number[]).includes(id)))) return fail();
      if (entry.directionMode !== undefined && !["zh-to-en", "en-to-zh", "random"].includes(String(entry.directionMode))) return fail();
      if (entry.questionType !== undefined && !["choice", "fill"].includes(String(entry.questionType))) return fail();
      if (entry.scope !== undefined && !["today", "custom", "review", "mistakes", "retry"].includes(String(entry.scope))) return fail();
      if (entry.statusFilters !== undefined && (!Array.isArray(entry.statusFilters) || !entry.statusFilters.every(status => ["known", "review", "unknown"].includes(status)))) return fail();
      if (entry.timerSeconds !== undefined && !integer(entry.timerSeconds, 5, 300)) return fail();
      history.push(entry as unknown as QuizHistoryEntry);
    }
  }
  const reviews: ReviewMap = {};
  if (p.reviews !== undefined) {
    if (!object(p.reviews)) return fail();
    for (const [key, item] of Object.entries(p.reviews)) {
      if (!ids.has(Number(key)) || !object(item) || !date(item.due) || typeof item.last !== "string" || (item.last !== "" && !Number.isFinite(Date.parse(item.last))) || !integer(item.streak, 0, 1000000) || !integer(item.mistakes, 0, 1000000)) return fail();
      reviews[Number(key)] = { due: item.due, last: item.last, streak: item.streak, mistakes: item.mistakes };
    }
  }
  return {
    exportedAt: typeof value.exportedAt === "string" && Number.isFinite(Date.parse(value.exportedAt)) ? value.exportedAt : "",
    progress: { statuses, notes, reviews, quizHistory: history,
      settings: { currentDay: s.currentDay, startDate: s.startDate, speechSpeed: s.speechSpeed as ProgressSnapshot["settings"]["speechSpeed"], speechSpeedVersion: typeof s.speechSpeedVersion === "number" ? s.speechSpeedVersion : 0, theme: s.theme === "dark" ? "dark" : "light", fontSize: s.fontSize === "small" || s.fontSize === "large" ? s.fontSize : "normal" } },
  };
}

export function mergeProgress(current: ProgressSnapshot, incoming: ProgressSnapshot): ProgressSnapshot {
  const history = new Map(incoming.quizHistory.map(entry => [entry.id, entry]));
  current.quizHistory.forEach(entry => history.set(entry.id, entry));
  return { ...current, statuses: { ...incoming.statuses, ...current.statuses }, notes: { ...incoming.notes, ...current.notes }, reviews: { ...incoming.reviews, ...current.reviews }, quizHistory: [...history.values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, 50) };
}
