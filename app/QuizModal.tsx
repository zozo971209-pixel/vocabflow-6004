"use client";

import { useEffect, useMemo, useState } from "react";
import { isChineseMeaningCorrect, isFillAnswerCorrect } from "./quizAnswers";

export type QuizWord = {
  id: number;
  level: number;
  word: string;
  meaning: string;
};

export type QuizDirectionMode = "zh-to-en" | "en-to-zh" | "random";
export type QuizQuestionType = "choice" | "fill";
export type QuizWordStatus = "known" | "review" | "unknown";

export type QuizHistoryEntry = {
  id: string;
  completedAt: string;
  startDay: number;
  endDay: number;
  total: number;
  correct: number;
  wrongWordIds: number[];
  questionType?: QuizQuestionType;
  directionMode?: QuizDirectionMode;
  statusFilters?: QuizWordStatus[];
  timerSeconds?: number;
};

type QuizQuestion = {
  word: QuizWord;
  direction: "en-to-zh" | "zh-to-en";
  prompt: string;
  answer: string;
  options: string[];
};

type Props = {
  words: QuizWord[];
  currentDay: number;
  totalDays: number;
  statuses: Record<number, QuizWordStatus>;
  history: QuizHistoryEntry[];
  onComplete: (entry: QuizHistoryEntry) => void;
  onClose: () => void;
};

const WORDS_PER_DAY = 50;
const TIMEOUT_VALUE = "__timeout__";
const directionModeLabels: Record<QuizDirectionMode, string> = {
  "zh-to-en": "中選英",
  "en-to-zh": "英選中",
  random: "隨機",
};
const fillDirectionModeLabels: Record<QuizDirectionMode, string> = {
  "zh-to-en": "中填英",
  "en-to-zh": "英填中",
  random: "隨機",
};
const questionTypeLabels: Record<QuizQuestionType, string> = {
  choice: "選擇題",
  fill: "填充題",
};
const statusLabels: Record<QuizWordStatus, string> = {
  known: "已熟悉",
  review: "待複習",
  unknown: "不熟",
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

export function compactMeaning(meaning: string) {
  const parts = meaning
    .replace(/\\n/g, "；")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]{1,24}\)/g, " ")
    .replace(/\b(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gi, " ")
    .split(/[\n；;，,、/|]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const unique = parts.filter((part, index) => {
    const normalized = part.toLowerCase();
    return parts.findIndex((other) => other.toLowerCase() === normalized) === index;
  });

  const broader = unique.filter((part) => !unique.some((other) => (
    other !== part && other.includes(part) && other.length <= part.length + 10
  )));
  const selected: string[] = [];
  let length = 0;
  for (const part of broader) {
    const addedLength = part.length + (selected.length ? 2 : 0);
    if (selected.length && length + addedLength > 38) break;
    selected.push(part);
    length += addedLength;
    if (selected.length === 3) break;
  }

  const result = selected.join("；") || meaning.replace(/\s+/g, " ").trim();
  return result.length > 42 ? `${result.slice(0, 41)}…` : result;
}

function makeOptions(target: QuizWord, direction: QuizQuestion["direction"], pool: QuizWord[]) {
  const valueFor = (word: QuizWord) => direction === "en-to-zh" ? compactMeaning(word.meaning) : word.word;
  const answer = valueFor(target);
  const preferred = pool.filter((word) => word.id !== target.id && Math.abs(word.level - target.level) <= 1);
  const candidates = shuffle([...preferred, ...pool.filter((word) => word.id !== target.id)]);
  const options = [answer];

  for (const candidate of candidates) {
    const value = valueFor(candidate);
    if (!value || options.some((option) => option.toLowerCase() === value.toLowerCase())) continue;
    options.push(value);
    if (options.length === 4) break;
  }
  return shuffle(options);
}

function makeQuestions(scope: QuizWord[], allWords: QuizWord[], mode: QuizDirectionMode, questionType: QuizQuestionType) {
  return shuffle(scope).map((word) => {
    const direction: QuizQuestion["direction"] = mode === "random"
      ? (Math.random() < 0.5 ? "en-to-zh" : "zh-to-en")
      : mode;
    return {
      word,
      direction,
      prompt: direction === "en-to-zh" ? word.word : compactMeaning(word.meaning),
      answer: direction === "en-to-zh" ? compactMeaning(word.meaning) : word.word,
      options: questionType === "choice" ? makeOptions(word, direction, allWords) : [],
    };
  });
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function QuizModal({ words, currentDay, totalDays, statuses, history, onComplete, onClose }: Props) {
  const [rangeMode, setRangeMode] = useState<"today" | "custom">("today");
  const [questionType, setQuestionType] = useState<QuizQuestionType>("choice");
  const [directionMode, setDirectionMode] = useState<QuizDirectionMode>("random");
  const [statusFilters, setStatusFilters] = useState<QuizWordStatus[]>([]);
  const [startDay, setStartDay] = useState(currentDay);
  const [endDay, setEndDay] = useState(currentDay);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWordIds, setWrongWordIds] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  const effectiveStart = rangeMode === "today" ? currentDay : Math.min(startDay, endDay);
  const effectiveEnd = rangeMode === "today" ? currentDay : Math.max(startDay, endDay);
  const scope = useMemo(() => {
    const start = (effectiveStart - 1) * WORDS_PER_DAY;
    const rangeWords = words.slice(start, effectiveEnd * WORDS_PER_DAY);
    return statusFilters.length
      ? rangeWords.filter((word) => statusFilters.includes(statuses[word.id]))
      : rangeWords;
  }, [effectiveStart, effectiveEnd, statusFilters, statuses, words]);
  const current = questions[questionIndex];
  const currentAnswerCorrect = Boolean(current && selected && selected !== TIMEOUT_VALUE && (
    questionType === "fill"
      ? current.direction === "zh-to-en"
        ? isFillAnswerCorrect(selected, current.word.word)
        : isChineseMeaningCorrect(selected, current.word.meaning)
      : selected === current.answer
  ));

  useEffect(() => {
    if (!current || !timerEnabled || selected || finished) return;
    const timer = window.setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        setSelected(TIMEOUT_VALUE);
        setWrongWordIds((ids) => ids.includes(current.word.id) ? ids : [...ids, current.word.id]);
      } else {
        setRemainingSeconds((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [current, timerEnabled, selected, finished, remainingSeconds]);

  function startQuiz() {
    const nextQuestions = makeQuestions(scope, words, directionMode, questionType);
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setSelected(null);
    setFillAnswer("");
    setCorrectCount(0);
    setWrongWordIds([]);
    setFinished(false);
    setRemainingSeconds(timerSeconds);
  }

  function answer(option: string) {
    if (selected || !current) return;
    setSelected(option);
    if (option === current.answer) {
      setCorrectCount((count) => count + 1);
    } else {
      setWrongWordIds((ids) => [...ids, current.word.id]);
    }
  }

  function submitFillAnswer() {
    if (selected || !current || !fillAnswer.trim()) return;
    const submitted = fillAnswer.trim();
    setSelected(submitted);
    const isCorrect = current.direction === "zh-to-en"
      ? isFillAnswerCorrect(submitted, current.word.word)
      : isChineseMeaningCorrect(submitted, current.word.meaning);
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
    } else {
      setWrongWordIds((ids) => [...ids, current.word.id]);
    }
  }

  function nextQuestion() {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((index) => index + 1);
      setSelected(null);
      setFillAnswer("");
      setRemainingSeconds(timerSeconds);
      return;
    }

    const entry: QuizHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      completedAt: new Date().toISOString(),
      startDay: effectiveStart,
      endDay: effectiveEnd,
      total: questions.length,
      correct: correctCount,
      wrongWordIds,
      questionType,
      directionMode,
      statusFilters,
      timerSeconds: timerEnabled ? timerSeconds : undefined,
    };
    onComplete(entry);
    setFinished(true);
  }

  function resetQuiz() {
    setQuestions([]);
    setQuestionIndex(0);
    setSelected(null);
    setFillAnswer("");
    setCorrectCount(0);
    setWrongWordIds([]);
    setFinished(false);
  }

  function toggleStatus(status: QuizWordStatus) {
    setStatusFilters((current) => current.includes(status)
      ? current.filter((value) => value !== status)
      : [...current, status]);
  }

  const wrongWords = finished
    ? wrongWordIds.map((id) => words.find((word) => word.id === id)).filter((word): word is QuizWord => Boolean(word))
    : [];

  return (
    <div className="quiz-backdrop">
      <section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
        <button className="modal-close" onClick={onClose} aria-label="關閉測驗">×</button>

        {!questions.length && (
          <>
            <p className="eyebrow">VOCABULARY QUIZ</p>
            <h2 id="quiz-title">單字測驗</h2>
            <div className="quiz-mode-tabs" role="group" aria-label="選擇測驗範圍">
              <button className={rangeMode === "today" ? "active" : ""} onClick={() => setRangeMode("today")}>當日 50 詞</button>
              <button className={rangeMode === "custom" ? "active" : ""} onClick={() => setRangeMode("custom")}>自訂天數</button>
            </div>
            {rangeMode === "custom" && (
              <div className="quiz-range">
                <label><span>從第幾天</span><input type="number" min="1" max={totalDays} value={startDay} onChange={(event) => setStartDay(Math.max(1, Math.min(totalDays, Number(event.target.value))))} /></label>
                <label><span>到第幾天</span><input type="number" min="1" max={totalDays} value={endDay} onChange={(event) => setEndDay(Math.max(1, Math.min(totalDays, Number(event.target.value))))} /></label>
              </div>
            )}
            <div className="quiz-status-picker">
              <span>熟悉度（可複選）</span>
              <div className="quiz-status-options" role="group" aria-label="依熟悉度篩選測驗單字">
                {(["known", "review", "unknown"] as QuizWordStatus[]).map((status) => (
                  <button
                    key={status}
                    className={`${statusFilters.includes(status) ? "active" : ""} ${status}`}
                    aria-pressed={statusFilters.includes(status)}
                    onClick={() => toggleStatus(status)}
                  >
                    <span>{statusFilters.includes(status) ? "✓" : ""}</span>{statusLabels[status]}
                  </button>
                ))}
              </div>
              <small>{statusFilters.length ? `只測：${statusFilters.map((status) => statusLabels[status]).join("＋")}` : "未選狀態：包含此天數範圍內全部單字"}</small>
            </div>
            <div className="quiz-question-type-picker">
              <span>題型</span>
              <div className="quiz-question-type-options" role="group" aria-label="選擇測驗題型">
                {(["choice", "fill"] as QuizQuestionType[]).map((type) => (
                  <button key={type} className={questionType === type ? "active" : ""} onClick={() => setQuestionType(type)}>
                    {questionTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="quiz-direction-picker">
              <span>出題方式</span>
              <div className="quiz-direction-options" role="group" aria-label="選擇出題方式">
                {(["zh-to-en", "en-to-zh", "random"] as QuizDirectionMode[]).map((mode) => (
                  <button key={mode} className={directionMode === mode ? "active" : ""} onClick={() => setDirectionMode(mode)}>
                    {questionType === "fill" ? fillDirectionModeLabels[mode] : directionModeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>
            {questionType === "fill" && <p className="quiz-fill-note">中填英不分大小寫，常見斜線與括號變體都可作答；英填中只需輸入其中一個正確中文意思。</p>}
            <div className="quiz-timer-picker">
              <label>
                <input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} />
                <span>啟用每題計時</span>
              </label>
              {timerEnabled && (
                <label><span>每題</span><input type="number" min="5" max="300" value={timerSeconds} onChange={(event) => setTimerSeconds(Math.max(5, Math.min(300, Number(event.target.value) || 5)))} /><span>秒</span></label>
              )}
              <small>時間到會顯示正確答案，由你按「下一題」。</small>
            </div>
            <div className="quiz-summary">
              <strong>Day {effectiveStart}{effectiveEnd !== effectiveStart ? `–${effectiveEnd}` : ""}</strong>
              <span>{scope.length} 題 · {questionType === "fill" ? `${fillDirectionModeLabels[directionMode]} · 填充題` : `${directionModeLabels[directionMode]}四選一`}{timerEnabled ? ` · 每題 ${timerSeconds} 秒` : ""}</span>
            </div>
            <button className="primary-button full" onClick={startQuiz} disabled={!scope.length}>開始測驗</button>

            <div className="quiz-history">
              <h3>最近測驗</h3>
              {history.slice(0, 5).map((entry) => (
                <div key={entry.id}>
                  <span>{formatHistoryDate(entry.completedAt)} · Day {entry.startDay}{entry.endDay !== entry.startDay ? `–${entry.endDay}` : ""}{entry.questionType === "fill" ? ` · ${entry.directionMode ? fillDirectionModeLabels[entry.directionMode] : "填充題"}` : entry.directionMode ? ` · ${directionModeLabels[entry.directionMode]}` : ""}{entry.statusFilters?.length ? ` · ${entry.statusFilters.map((status) => statusLabels[status]).join("＋")}` : ""}{entry.timerSeconds ? ` · ${entry.timerSeconds} 秒` : ""}</span>
                  <strong>{entry.correct} / {entry.total}</strong>
                </div>
              ))}
              {!history.length && <p>尚無測驗紀錄。</p>}
            </div>
          </>
        )}

        {current && !finished && (
          <>
            <div className="quiz-progress-line">
              <span>第 {questionIndex + 1} / {questions.length} 題</span>
              <strong>{timerEnabled && <b className={`quiz-timer-clock ${remainingSeconds <= 5 ? "urgent" : ""}`}>⏱ {remainingSeconds} 秒</b>}{Math.round(((questionIndex + 1) / questions.length) * 100)}%</strong>
            </div>
            <div className="quiz-progress-track"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
            <p className="quiz-direction">{questionType === "fill" ? current.direction === "en-to-zh" ? "請輸入其中一個正確中文意思" : "請輸入對應的英文單字" : current.direction === "en-to-zh" ? "選出最合適的中文意思" : "選出對應的英文單字"}</p>
            <h2 className={current.direction === "zh-to-en" ? "quiz-prompt chinese" : "quiz-prompt"}>{current.prompt}</h2>
            {questionType === "choice" ? (
              <div className="quiz-options">
                {current.options.map((option, index) => {
                  const isCorrect = selected && option === current.answer;
                  const isWrong = selected === option && option !== current.answer;
                  return (
                    <button key={option} className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} onClick={() => answer(option)} disabled={Boolean(selected)}>
                      <span>{String.fromCharCode(65 + index)}</span>{option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form className="quiz-fill-answer" onSubmit={(event) => { event.preventDefault(); submitFillAnswer(); }}>
                <label htmlFor="quiz-fill-input">{current.direction === "en-to-zh" ? "中文答案" : "英文答案"}</label>
                <input
                  id="quiz-fill-input"
                  value={fillAnswer}
                  onChange={(event) => setFillAnswer(event.target.value)}
                  disabled={Boolean(selected)}
                  autoComplete="off"
                  autoCapitalize={current.direction === "en-to-zh" ? "sentences" : "none"}
                  spellCheck={current.direction === "en-to-zh"}
                  placeholder={current.direction === "en-to-zh" ? "輸入一個中文意思" : "輸入英文單字"}
                  autoFocus
                />
                <button className="primary-button" type="submit" disabled={Boolean(selected) || !fillAnswer.trim()}>送出答案</button>
              </form>
            )}
            {selected && (
              <div className={`quiz-feedback ${currentAnswerCorrect ? "correct" : "wrong"}`}>
                <strong>{currentAnswerCorrect ? "答對了" : selected === TIMEOUT_VALUE ? "時間到" : "答錯了"}</strong>
                {!currentAnswerCorrect && <span>正確答案：{current.answer}</span>}
              </div>
            )}
            <button className="primary-button full quiz-next" onClick={nextQuestion} disabled={!selected}>
              {questionIndex + 1 === questions.length ? "查看結果" : "下一題"}
            </button>
          </>
        )}

        {finished && (
          <div className="quiz-result">
            <p className="eyebrow">QUIZ COMPLETE</p>
            <h2 id="quiz-title">測驗完成</h2>
            <div className="quiz-score"><strong>{correctCount}</strong><span>/ {questions.length} 題</span></div>
            <p>答對率 {questions.length ? Math.round((correctCount / questions.length) * 100) : 0}% · 錯 {wrongWordIds.length} 題</p>
            {wrongWords.length > 0 && (
              <div className="quiz-wrong-list">
                <h3>本次錯題</h3>
                {wrongWords.map((word) => <div key={word.id}><strong>{word.word}</strong><span>{compactMeaning(word.meaning)}</span></div>)}
              </div>
            )}
            <div className="quiz-result-actions">
              <button className="quiet-button quiz-secondary-button" onClick={resetQuiz}>再測一次</button>
              <button className="primary-button" onClick={onClose}>返回單字</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
