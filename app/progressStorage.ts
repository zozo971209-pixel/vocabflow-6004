import type { ProgressSnapshot } from "./progressBackup";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function persistProgress(storage: Store, progress: ProgressSnapshot) {
  const values = {
    "vocab6004-progress-v1": progress.statuses,
    "vocab6004-settings-v1": progress.settings,
    "vocab6004-quiz-history-v1": progress.quizHistory,
    "vocab6004-notes-v1": progress.notes,
    "vocab6004-review-v1": progress.reviews,
  };
  const before = new Map(Object.keys(values).map(key => [key, storage.getItem(key)]));
  const written: string[] = [];
  try {
    for (const [key, value] of Object.entries(values)) {
      const serialized = JSON.stringify(value);
      if (serialized === before.get(key)) continue;
      storage.setItem(key, serialized);
      written.push(key);
    }
  } catch {
    let restored = true;
    for (const key of written.reverse()) {
      try {
        const previous = before.get(key);
        if (previous === null || previous === undefined) storage.removeItem(key);
        else storage.setItem(key, previous);
      } catch { restored = false; }
    }
    throw new Error(restored
      ? "瀏覽器無法儲存紀錄，原有儲存資料已保留。請先匯出備份；目前畫面的新變更尚未儲存。"
      : "儲存失敗且無法完整回復，請立即匯出目前畫面的備份，暫勿重新整理。匯入前的復原備份仍保留。"
    );
  }
}
