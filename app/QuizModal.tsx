"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isChineseMeaningCorrect, isFillAnswerCorrect, fillAnswerFeedback } from "./quizAnswers";
import { defaultQuizPreferences, loadQuizPreferences, saveQuizPreferences, type SavedQuizDirectionMode, type SavedQuizQuestionType, type SavedQuizWordStatus } from "./quizPreferences";

export type QuizWord = { id: number; level: number; word: string; meaning: string };
export type QuizDirectionMode = SavedQuizDirectionMode;
export type QuizQuestionType = SavedQuizQuestionType;
export type QuizWordStatus = SavedQuizWordStatus;
export type QuizHistoryEntry = {
  id: string; completedAt: string; startDay: number; endDay: number; total: number; correct: number;
  wrongWordIds: number[]; testedWordIds?: number[];
  scope?: "today" | "custom" | "review" | "mistakes" | "retry";
  questionType?: QuizQuestionType; directionMode?: QuizDirectionMode; statusFilters?: QuizWordStatus[]; timerSeconds?: number;
};

type QuizQuestion = { word: QuizWord; direction: "en-to-zh" | "zh-to-en"; prompt: string; answer: string; options: string[] };
type Props = {
  words: QuizWord[]; currentDay: number; totalDays: number; presetWords?: QuizWord[]; settingsOnly?: boolean; autoStart?: boolean;
  onComplete: (entry: QuizHistoryEntry) => void; onClose: () => void;
};

const TIMEOUT_VALUE = "__timeout__";
const directionModeLabels: Record<QuizDirectionMode, string> = { "zh-to-en": "中選英", "en-to-zh": "英選中", random: "隨機" };
const fillDirectionModeLabels: Record<QuizDirectionMode, string> = { "zh-to-en": "中填英", "en-to-zh": "英填中", random: "隨機" };
const questionTypeLabels: Record<QuizQuestionType, string> = { choice: "選擇題", fill: "填充題" };

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

export function compactMeaning(meaning: string) {
  const parts = meaning.replace(/\\n/g, "；").replace(/\[[^\]]+\]/g, " ").replace(/\([^)]{1,24}\)/g, " ")
    .replace(/\b(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gi, " ").split(/[\n；;，,、/|]+/)
    .map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  const unique = parts.filter((part, index) => parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index);
  const broader = unique.filter((part) => !unique.some((other) => other !== part && other.includes(part) && other.length <= part.length + 10));
  const selected: string[] = [];
  let length = 0;
  for (const part of broader) {
    const addedLength = part.length + (selected.length ? 2 : 0);
    if (selected.length && length + addedLength > 38) break;
    selected.push(part); length += addedLength;
    if (selected.length === 3) break;
  }
  const result = selected.join("；") || meaning.replace(/\s+/g, " ").trim();
  return result.length > 42 ? `${result.slice(0, 41)}…` : result;
}

function makeOptions(target: QuizWord, direction: QuizQuestion["direction"], pool: QuizWord[]) {
  const valueFor = (word: QuizWord) => direction === "en-to-zh" ? compactMeaning(word.meaning) : word.word;
  const answer = valueFor(target);
  const candidates = shuffle([...pool.filter((word) => word.id !== target.id && Math.abs(word.level - target.level) <= 1), ...pool.filter((word) => word.id !== target.id)]);
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
    const direction: QuizQuestion["direction"] = mode === "random" ? (Math.random() < 0.5 ? "en-to-zh" : "zh-to-en") : mode;
    return { word, direction, prompt: direction === "en-to-zh" ? word.word : compactMeaning(word.meaning), answer: direction === "en-to-zh" ? compactMeaning(word.meaning) : word.word, options: questionType === "choice" ? makeOptions(word, direction, allWords) : [] };
  });
}

export default function QuizModal({ words, currentDay, totalDays, presetWords = [], settingsOnly = false, autoStart = false, onComplete, onClose }: Props) {
  const [initialPreferenceState] = useState(() => typeof window === "undefined" ? { preferences: defaultQuizPreferences(currentDay, totalDays) } : loadQuizPreferences(window.localStorage, currentDay, totalDays));
  const [questionType, setQuestionType] = useState<QuizQuestionType>(initialPreferenceState.preferences.questionType);
  const [directionMode, setDirectionMode] = useState<QuizDirectionMode>(initialPreferenceState.preferences.directionMode);
  const [timerEnabled, setTimerEnabled] = useState(initialPreferenceState.preferences.timerEnabled);
  const [timerSeconds, setTimerSeconds] = useState(initialPreferenceState.preferences.timerSeconds);
  const [settingsError, setSettingsError] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWordIds, setWrongWordIds] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timerSeconds);
  const [activeScope, setActiveScope] = useState<QuizHistoryEntry["scope"]>("custom");
  const autoStarted = useRef(false);
  const current = questions[questionIndex];
  const currentAnswerCorrect = Boolean(current && selected && selected !== TIMEOUT_VALUE && (questionType === "fill" ? current.direction === "zh-to-en" ? isFillAnswerCorrect(selected, current.word.word) : isChineseMeaningCorrect(selected, current.word.meaning) : selected === current.answer));

  const persistSettings = useCallback(() => {
    try {
      saveQuizPreferences(window.localStorage, { ...initialPreferenceState.preferences, questionType, directionMode, timerEnabled, timerSeconds });
      setSettingsError("");
      return true;
    } catch {
      setSettingsError("無法保存測驗設定，請確認瀏覽器儲存權限後再試。");
      return false;
    }
  }, [directionMode, initialPreferenceState.preferences, questionType, timerEnabled, timerSeconds]);

  const startQuiz = useCallback((selectedWords = presetWords, retry = false) => {
    if (!selectedWords.length) return;
    if (!retry) persistSettings();
    setActiveScope(retry ? "retry" : "custom");
    setQuestions(makeQuestions(selectedWords, words, directionMode, questionType));
    setQuestionIndex(0); setSelected(null); setFillAnswer(""); setCorrectCount(0); setWrongWordIds([]); setFinished(false); setRemainingSeconds(timerSeconds);
  }, [directionMode, persistSettings, presetWords, questionType, timerSeconds, words]);

  useEffect(() => {
    if (settingsOnly || !autoStart || autoStarted.current || !presetWords.length) return;
    autoStarted.current = true;
    startQuiz(presetWords);
  }, [autoStart, presetWords, settingsOnly, startQuiz]);

  useEffect(() => {
    if (!current || !timerEnabled || selected || finished) return;
    const timer = window.setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0); setSelected(TIMEOUT_VALUE);
        setWrongWordIds((ids) => ids.includes(current.word.id) ? ids : [...ids, current.word.id]);
      } else setRemainingSeconds((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [current, timerEnabled, selected, finished, remainingSeconds]);

  function answer(option: string) {
    if (selected || !current) return;
    setSelected(option);
    if (option === current.answer) setCorrectCount((count) => count + 1);
    else setWrongWordIds((ids) => ids.includes(current.word.id) ? ids : [...ids, current.word.id]);
  }

  function submitFillAnswer() {
    if (selected || !current || !fillAnswer.trim()) return;
    const submitted = fillAnswer.trim();
    setSelected(submitted);
    const correct = current.direction === "zh-to-en" ? isFillAnswerCorrect(submitted, current.word.word) : isChineseMeaningCorrect(submitted, current.word.meaning);
    if (correct) setCorrectCount((count) => count + 1);
    else setWrongWordIds((ids) => ids.includes(current.word.id) ? ids : [...ids, current.word.id]);
  }

  function nextQuestion() {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((index) => index + 1); setSelected(null); setFillAnswer(""); setRemainingSeconds(timerSeconds); return;
    }
    onComplete({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, completedAt: new Date().toISOString(), startDay: currentDay, endDay: currentDay, total: questions.length, correct: correctCount, wrongWordIds, testedWordIds: questions.map((question) => question.word.id), scope: activeScope, questionType, directionMode, timerSeconds: timerEnabled ? timerSeconds : undefined });
    setFinished(true);
  }

  const wrongWords = finished ? wrongWordIds.map((id) => words.find((word) => word.id === id)).filter((word): word is QuizWord => Boolean(word)) : [];

  return <div className="quiz-backdrop"><section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
    <button className="modal-close" onClick={onClose} aria-label={settingsOnly ? "關閉測驗設定" : "關閉測驗"}>×</button>
    {settingsOnly && !questions.length && <>
      <h2 id="quiz-title">測驗設定</h2>
      <div className="quiz-question-type-picker"><span>題型</span><div className="quiz-question-type-options" role="group" aria-label="選擇測驗題型">{(["choice", "fill"] as QuizQuestionType[]).map((type) => <button key={type} className={questionType === type ? "active" : ""} onClick={() => setQuestionType(type)}>{questionTypeLabels[type]}</button>)}</div></div>
      <div className="quiz-direction-picker"><span>出題方式</span><div className="quiz-direction-options" role="group" aria-label="選擇出題方式">{(["zh-to-en", "en-to-zh", "random"] as QuizDirectionMode[]).map((mode) => <button key={mode} className={directionMode === mode ? "active" : ""} onClick={() => setDirectionMode(mode)}>{questionType === "fill" ? fillDirectionModeLabels[mode] : directionModeLabels[mode]}</button>)}</div></div>
      <div className="quiz-timer-picker"><label><input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} /><span>啟用每題計時</span></label>{timerEnabled && <label><span>每題</span><input type="number" min="5" max="300" value={timerSeconds} onChange={(event) => setTimerSeconds(Math.max(5, Math.min(300, Number(event.target.value) || 5)))} /><span>秒</span></label>}</div>
      {settingsError && <p className="quiz-preference-feedback error" role="alert">{settingsError}</p>}
      <button className="primary-button full" onClick={() => { if (persistSettings()) onClose(); }}>儲存設定</button>
    </>}
    {!settingsOnly && !questions.length && <p className="quiz-loading" id="quiz-title">正在準備測驗…</p>}
    {current && !finished && <>
      <div className="quiz-progress-line"><span>第 {questionIndex + 1} / {questions.length} 題</span><strong>{timerEnabled && <b className={`quiz-timer-clock ${remainingSeconds <= 5 ? "urgent" : ""}`}>⏱ {remainingSeconds} 秒</b>}{Math.round(((questionIndex + 1) / questions.length) * 100)}%</strong></div>
      <div className="quiz-progress-track"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
      <p className="quiz-direction">{questionType === "fill" ? current.direction === "en-to-zh" ? "請輸入其中一個正確中文意思" : "請輸入對應的英文單字" : current.direction === "en-to-zh" ? "選出最合適的中文意思" : "選出對應的英文單字"}</p>
      <h2 className={current.direction === "zh-to-en" ? "quiz-prompt chinese" : "quiz-prompt"}>{current.prompt}</h2>
      {questionType === "choice" ? <div className="quiz-options">{current.options.map((option, index) => { const isCorrect = selected && option === current.answer; const isWrong = selected === option && option !== current.answer; return <button key={option} className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} onClick={() => answer(option)} disabled={Boolean(selected)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>; })}</div> : <form className="quiz-fill-answer" onSubmit={(event) => { event.preventDefault(); submitFillAnswer(); }}><label htmlFor="quiz-fill-input">{current.direction === "en-to-zh" ? "中文答案" : "英文答案"}</label><input id="quiz-fill-input" value={fillAnswer} onChange={(event) => setFillAnswer(event.target.value)} disabled={Boolean(selected)} autoComplete="off" autoCapitalize={current.direction === "en-to-zh" ? "sentences" : "none"} spellCheck={current.direction === "en-to-zh"} placeholder={current.direction === "en-to-zh" ? "輸入一個中文意思" : "輸入英文單字"} autoFocus /><button className="primary-button" type="submit" disabled={Boolean(selected) || !fillAnswer.trim()}>送出答案</button></form>}
      {selected && <div className={`quiz-feedback ${currentAnswerCorrect ? "correct" : "wrong"}`}><strong>{currentAnswerCorrect ? "答對了" : selected === TIMEOUT_VALUE ? "時間到" : "答錯了"}</strong>{!currentAnswerCorrect && <span>正確答案：{current.answer}</span>}{!currentAnswerCorrect && questionType === "fill" && selected !== TIMEOUT_VALUE && <span>{fillAnswerFeedback(selected, current.word.word, current.direction)}</span>}</div>}
      <button className="primary-button full quiz-next" onClick={nextQuestion} disabled={!selected}>{questionIndex + 1 === questions.length ? "查看結果" : "下一題"}</button>
    </>}
    {finished && <div className="quiz-result"><h2 id="quiz-title">測驗完成</h2><div className="quiz-score"><strong>{correctCount}</strong><span>/ {questions.length} 題</span></div><p>答對率 {questions.length ? Math.round((correctCount / questions.length) * 100) : 0}% · 錯 {wrongWordIds.length} 題</p>{wrongWords.length > 0 && <div className="quiz-wrong-list"><h3>本次錯題</h3>{wrongWords.map((word) => <div key={word.id}><strong>{word.word}</strong><span>{compactMeaning(word.meaning)}</span></div>)}</div>}<div className="quiz-result-actions">{wrongWords.length > 0 && <button className="quiet-button quiz-secondary-button" onClick={() => startQuiz(wrongWords, true)}>只重練本次錯題（{wrongWords.length}）</button>}<button className="quiet-button quiz-secondary-button" onClick={() => startQuiz(presetWords.length ? presetWords : questions.map((question) => question.word))}>再測一次</button><button className="primary-button" onClick={onClose}>返回單字</button></div></div>}
  </section></div>;
}
