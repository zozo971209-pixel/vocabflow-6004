export type SavedQuizRangeMode = "today" | "custom" | "review" | "mistakes";
export type SavedQuizQuestionType = "choice" | "fill";
export type SavedQuizDirectionMode = "zh-to-en" | "en-to-zh" | "random";
export type SavedQuizWordStatus = "known" | "review" | "unknown";

export type QuizPreferences = {
  rangeMode: SavedQuizRangeMode;
  questionType: SavedQuizQuestionType;
  directionMode: SavedQuizDirectionMode;
  statusFilters: SavedQuizWordStatus[];
  startDay: number;
  endDay: number;
  timerEnabled: boolean;
  timerSeconds: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const QUIZ_PREFERENCES_KEY = "vocab6004-quiz-preferences-v1";

const rangeModes: SavedQuizRangeMode[] = ["today", "custom", "review", "mistakes"];
const questionTypes: SavedQuizQuestionType[] = ["choice", "fill"];
const directionModes: SavedQuizDirectionMode[] = ["zh-to-en", "en-to-zh", "random"];
const wordStatuses: SavedQuizWordStatus[] = ["known", "review", "unknown"];

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}

export function defaultQuizPreferences(currentDay: number, totalDays: number): QuizPreferences {
  const safeDay = clampInteger(currentDay, 1, totalDays, 1);
  return {
    rangeMode: "today",
    questionType: "choice",
    directionMode: "random",
    statusFilters: [],
    startDay: safeDay,
    endDay: safeDay,
    timerEnabled: false,
    timerSeconds: 30,
  };
}

export function loadQuizPreferences(storage: StorageLike, currentDay: number, totalDays: number) {
  const defaults = defaultQuizPreferences(currentDay, totalDays);
  try {
    const raw = storage.getItem(QUIZ_PREFERENCES_KEY);
    if (!raw) return { preferences: defaults, restored: false };
    const parsed = JSON.parse(raw) as Partial<QuizPreferences>;
    const statusFilters = Array.isArray(parsed.statusFilters)
      ? [...new Set(parsed.statusFilters.filter((status): status is SavedQuizWordStatus => wordStatuses.includes(status as SavedQuizWordStatus)))]
      : [];
    return {
      restored: true,
      preferences: {
        rangeMode: rangeModes.includes(parsed.rangeMode as SavedQuizRangeMode) ? parsed.rangeMode as SavedQuizRangeMode : defaults.rangeMode,
        questionType: questionTypes.includes(parsed.questionType as SavedQuizQuestionType) ? parsed.questionType as SavedQuizQuestionType : defaults.questionType,
        directionMode: directionModes.includes(parsed.directionMode as SavedQuizDirectionMode) ? parsed.directionMode as SavedQuizDirectionMode : defaults.directionMode,
        statusFilters,
        startDay: clampInteger(parsed.startDay, 1, totalDays, defaults.startDay),
        endDay: clampInteger(parsed.endDay, 1, totalDays, defaults.endDay),
        timerEnabled: typeof parsed.timerEnabled === "boolean" ? parsed.timerEnabled : defaults.timerEnabled,
        timerSeconds: clampInteger(parsed.timerSeconds, 5, 300, defaults.timerSeconds),
      },
    };
  } catch {
    return { preferences: defaults, restored: false };
  }
}

export function saveQuizPreferences(storage: StorageLike, preferences: QuizPreferences) {
  storage.setItem(QUIZ_PREFERENCES_KEY, JSON.stringify(preferences));
}
