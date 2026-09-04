"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import QuizModal, { QuizHistoryEntry, QuizWordStatus } from "./QuizModal";
import WordDetails from "./WordDetails";
import { isVerifiedEnrichmentRecord, VerifiedEnrichmentRecord } from "./enrichment";
import { AiEnrichmentPayload, AiEnrichmentWord, isAiEnrichmentPayload } from "./aiEnrichment";
import { BilingualExample, isBilingualExamplePayload } from "./bilingualExamples";
import { buildWordFamilyMap } from "./wordEnhancements";
import { parseMeaningGroups } from "./meaningGroups";

type Word = {
  id: number;
  level: number;
  word: string;
  pos: string;
  phonetic: string;
  meaning: string;
  note: string;
};

type WordStatus = QuizWordStatus;
type StatusMap = Record<number, WordStatus>;
type SpeechSpeed = "ultraSlow" | "slow" | "normal";
type ThemeMode = "light" | "dark";
type FontSizeMode = "small" | "normal" | "large";
type BackupFeedback = { type: "success" | "error"; text: string } | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY = "vocab6004-progress-v1";
const SETTINGS_KEY = "vocab6004-settings-v1";
const QUIZ_HISTORY_KEY = "vocab6004-quiz-history-v1";
const NOTES_KEY = "vocab6004-notes-v1";
const SPEECH_SPEED_VERSION = 3;
const WORDS_PER_DAY = 50;
const BASE_PATH = "/vocabflow-6004";
const today = new Date().toISOString().slice(0, 10);

const statusMeta: Record<WordStatus, { label: string; icon: string }> = {
  known: { label: "已熟悉", icon: "✓" },
  review: { label: "待複習", icon: "↻" },
  unknown: { label: "不熟", icon: "!" },
};

const speechRates: Record<SpeechSpeed, number> = {
  normal: 0.52,
  slow: 0.26,
  ultraSlow: 0.13,
};

function restoreSpeechSpeed(value: unknown, version: unknown): SpeechSpeed {
  if (version === SPEECH_SPEED_VERSION && value === "ultraSlow") return "ultraSlow";
  if ((version === 2 || version === SPEECH_SPEED_VERSION) && value === "slow") return "slow";
  return "normal";
}

function nextSpeechSpeed(value: SpeechSpeed): SpeechSpeed {
  if (value === "normal") return "slow";
  if (value === "slow") return "ultraSlow";
  return "normal";
}

function cleanSpeechText(text: string, lang: "en-US" | "zh-TW") {
  if (lang === "en-US") {
    if (text.trim().toLowerCase() === "a/an") return "a book. an apple.";
    return text
      .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
      .replace(/\b(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gi, " ")
      .replace(/[\/\\|]+/g, ", ")
      .replace(/&/g, " and ")
      .replace(/[*_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return text
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/\b(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gim, " ")
    .replace(/[\/\\|*_~]/g, "，")
    .replace(/\s+/g, " ")
    .trim();
}

function speak(text: string, lang: "en-US" | "zh-TW", speed: SpeechSpeed) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text, lang));
  utterance.lang = lang;
  utterance.rate = speechRates[speed];
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.startsWith(lang.slice(0, 2))) ?? null;
  window.speechSynthesis.speak(utterance);
}

function formatDate(dateString: string, offset: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function dateValueWithOffset(dateString: string, offset: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayNumberForDate(startDate: string, selectedDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [selectedYear, selectedMonth, selectedDay] = selectedDate.split("-").map(Number);
  const startTime = Date.UTC(startYear, startMonth - 1, startDay);
  const selectedTime = Date.UTC(selectedYear, selectedMonth - 1, selectedDay);
  return Math.round((selectedTime - startTime) / 86_400_000) + 1;
}

export default function Home() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [currentDay, setCurrentDay] = useState(1);
  const [startDate, setStartDate] = useState(today);
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>("normal");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [fontSize, setFontSize] = useState<FontSizeMode>("normal");
  const [wordNotes, setWordNotes] = useState<Record<number, string>>({});
  const [enrichmentRecords, setEnrichmentRecords] = useState<VerifiedEnrichmentRecord[]>([]);
  const [aiEnrichment, setAiEnrichment] = useState<Record<string, AiEnrichmentWord>>({});
  const [aiGlosses, setAiGlosses] = useState<Record<string, string>>({});
  const [aiEnrichmentMeta, setAiEnrichmentMeta] = useState<Pick<AiEnrichmentPayload, "notice" | "source"> | null>(null);
  const [bilingualExamples, setBilingualExamples] = useState<Record<string, BilingualExample[]>>({});
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaFeedback, setPwaFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WordStatus | "unmarked">("all");
  const [levelFilter, setLevelFilter] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);
  const [backupFeedback, setBackupFeedback] = useState<BackupFeedback>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/vocab.json`).then((res) => res.json()),
      fetch(`${BASE_PATH}/enrichment.json`).then((res) => res.json()),
      fetch(`${BASE_PATH}/enrichment-ai.json`).then((res) => res.json()),
      fetch(`${BASE_PATH}/bilingual-examples.json`).then((res) => res.json()),
      Promise.resolve(localStorage.getItem(STORAGE_KEY)),
      Promise.resolve(localStorage.getItem(SETTINGS_KEY)),
      Promise.resolve(localStorage.getItem(QUIZ_HISTORY_KEY)),
      Promise.resolve(localStorage.getItem(NOTES_KEY)),
    ]).then(([data, enrichment, aiData, exampleData, savedStatuses, savedSettings, savedQuizHistory, savedNotes]) => {
      setWords(data as Word[]);
      if (enrichment && typeof enrichment === "object" && (enrichment as { schemaVersion?: unknown }).schemaVersion === 1) {
        const candidateRecords = (enrichment as { records?: unknown }).records;
        if (Array.isArray(candidateRecords)) setEnrichmentRecords(candidateRecords.filter(isVerifiedEnrichmentRecord));
      }
      if (isAiEnrichmentPayload(aiData)) {
        setAiEnrichment(aiData.words);
        setAiGlosses(aiData.glosses ?? {});
        setAiEnrichmentMeta({ notice: aiData.notice, source: aiData.source });
      }
      if (isBilingualExamplePayload(exampleData)) {
        setBilingualExamples(exampleData.words);
      }
      if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setCurrentDay(settings.currentDay ?? 1);
        setStartDate(settings.startDate ?? today);
        setSpeechSpeed(restoreSpeechSpeed(settings.speechSpeed, settings.speechSpeedVersion));
        setTheme(settings.theme === "dark" ? "dark" : "light");
        setFontSize(["small", "normal", "large"].includes(settings.fontSize) ? settings.fontSize : "normal");
      }
      if (savedQuizHistory) setQuizHistory(JSON.parse(savedQuizHistory));
      if (savedNotes) setWordNotes(JSON.parse(savedNotes));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currentDay, startDate, speechSpeed, speechSpeedVersion: SPEECH_SPEED_VERSION, theme, fontSize }));
  }, [currentDay, startDate, speechSpeed, theme, fontSize, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(quizHistory));
  }, [quizHistory, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(NOTES_KEY, JSON.stringify(wordNotes));
  }, [wordNotes, loaded]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fontSize = fontSize;
  }, [theme, fontSize]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {
        setPwaFeedback("離線功能註冊失敗，請重新整理後再試。");
      });
    }
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  const totalDays = Math.max(1, Math.ceil(words.length / WORDS_PER_DAY));
  const familyMap = useMemo(() => buildWordFamilyMap(words), [words]);
  const enrichmentMap = useMemo(() => {
    const map = new Map<number, VerifiedEnrichmentRecord[]>();
    enrichmentRecords.forEach((record) => map.set(record.wordId, [...(map.get(record.wordId) ?? []), record]));
    return map;
  }, [enrichmentRecords]);
  const safeDay = Math.min(currentDay, totalDays);
  const selectedLearningDate = dateValueWithOffset(startDate, safeDay - 1);
  const planEndDate = dateValueWithOffset(startDate, totalDays - 1);
  const dayWords = useMemo(() => {
    const start = (safeDay - 1) * WORDS_PER_DAY;
    return words.slice(start, start + WORDS_PER_DAY);
  }, [words, safeDay]);

  const filteredWords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized ? words : dayWords;
    return source.filter((word) => {
      const matchesQuery = !normalized || word.word.toLowerCase().includes(normalized) ||
        word.meaning.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "unmarked" ? !statuses[word.id] : statuses[word.id] === statusFilter);
      const matchesLevel = levelFilter === 0 || word.level === levelFilter;
      return matchesQuery && matchesStatus && matchesLevel;
    }).slice(0, normalized ? 120 : WORDS_PER_DAY);
  }, [query, words, dayWords, statusFilter, levelFilter, statuses]);

  const allCounts = useMemo(() => ({
    known: Object.values(statuses).filter((s) => s === "known").length,
    review: Object.values(statuses).filter((s) => s === "review").length,
    unknown: Object.values(statuses).filter((s) => s === "unknown").length,
  }), [statuses]);

  const dayDone = dayWords.filter((word) => statuses[word.id]).length;
  const progress = dayWords.length ? Math.round((dayDone / dayWords.length) * 100) : 0;

  function mark(id: number, status: WordStatus) {
    setStatuses((current) => ({ ...current, [id]: status }));
  }

  function changeDay(next: number) {
    setCurrentDay(Math.max(1, Math.min(totalDays, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeLearningDate(dateString: string) {
    if (!dateString) return;
    changeDay(dayNumberForDate(startDate, dateString));
  }

  function updateWordNote(id: number, note: string) {
    setWordNotes((current) => {
      const next = { ...current };
      if (note) next[id] = note;
      else delete next[id];
      return next;
    });
  }

  async function installPwa() {
    if (!installPrompt) {
      setPwaFeedback("若沒有安裝按鈕，請用瀏覽器選單的「安裝應用程式」或「加到主畫面」。");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setPwaFeedback(choice.outcome === "accepted" ? "已接受安裝。" : "已取消安裝，可稍後再試。");
    setInstallPrompt(null);
  }

  function exportProgress() {
    const backup = {
      format: "vocabflow-progress",
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "詞序 VocabFlow",
      progress: {
        statuses,
        settings: { currentDay: safeDay, startDate, speechSpeed, speechSpeedVersion: SPEECH_SPEED_VERSION, theme, fontSize },
        quizHistory,
        notes: wordNotes,
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VocabFlow-進度備份-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupFeedback({ type: "success", text: "備份檔已匯出，請妥善保存在手機檔案或雲端硬碟。" });
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text()) as Record<string, unknown>;
      if (backup.format !== "vocabflow-progress" || backup.version !== 1) {
        throw new Error("這不是 VocabFlow 支援的進度備份檔。");
      }

      const progress = backup.progress as Record<string, unknown> | undefined;
      const importedStatuses = progress?.statuses as Record<string, unknown> | undefined;
      const importedSettings = progress?.settings as Record<string, unknown> | undefined;
      if (!progress || !importedStatuses || !importedSettings) {
        throw new Error("備份檔缺少必要的進度資料。");
      }

      const validIds = new Set(words.map((word) => word.id));
      const nextStatuses: StatusMap = {};
      for (const [rawId, value] of Object.entries(importedStatuses)) {
        const id = Number(rawId);
        if (validIds.has(id) && (value === "known" || value === "review" || value === "unknown")) {
          nextStatuses[id] = value;
        }
      }

      const rawDay = importedSettings.currentDay;
      const rawStartDate = importedSettings.startDate;
      const rawSpeed = importedSettings.speechSpeed;
      const rawSpeedVersion = importedSettings.speechSpeedVersion;
      const rawTheme = importedSettings.theme;
      const rawFontSize = importedSettings.fontSize;
      if (typeof rawDay !== "number" || !Number.isFinite(rawDay) ||
          typeof rawStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawStartDate) ||
          (rawSpeed !== "ultraSlow" && rawSpeed !== "slow" && rawSpeed !== "normal")) {
        throw new Error("備份檔中的學習設定格式不正確。");
      }

      setStatuses(nextStatuses);
      setCurrentDay(Math.max(1, Math.min(totalDays, Math.round(rawDay))));
      setStartDate(rawStartDate);
      setSpeechSpeed(restoreSpeechSpeed(rawSpeed, rawSpeedVersion));
      if (rawTheme === "light" || rawTheme === "dark") setTheme(rawTheme);
      if (rawFontSize === "small" || rawFontSize === "normal" || rawFontSize === "large") setFontSize(rawFontSize);
      if (progress.notes && typeof progress.notes === "object" && !Array.isArray(progress.notes)) {
        const nextNotes: Record<number, string> = {};
        for (const [rawId, value] of Object.entries(progress.notes as Record<string, unknown>)) {
          const id = Number(rawId);
          if (validIds.has(id) && typeof value === "string" && value.length <= 500) nextNotes[id] = value;
        }
        setWordNotes(nextNotes);
      }
      if (Array.isArray(progress.quizHistory)) {
        const nextHistory = progress.quizHistory.filter((entry): entry is QuizHistoryEntry => {
          if (!entry || typeof entry !== "object") return false;
          const item = entry as Record<string, unknown>;
          return typeof item.id === "string" && typeof item.completedAt === "string" &&
            typeof item.startDay === "number" && typeof item.endDay === "number" &&
            typeof item.total === "number" && typeof item.correct === "number" &&
            (item.directionMode === undefined || item.directionMode === "zh-to-en" || item.directionMode === "en-to-zh" || item.directionMode === "random") &&
            (item.statusFilters === undefined || (Array.isArray(item.statusFilters) && item.statusFilters.every((status) => status === "known" || status === "review" || status === "unknown"))) &&
            Array.isArray(item.wrongWordIds) && item.wrongWordIds.every((id) => typeof id === "number" && validIds.has(id)) &&
            (item.timerSeconds === undefined || (typeof item.timerSeconds === "number" && item.timerSeconds >= 5 && item.timerSeconds <= 300));
        }).slice(0, 50);
        setQuizHistory(nextHistory);
      }
      setBackupFeedback({
        type: "success",
        text: `匯入完成，已恢復 ${Object.keys(nextStatuses).length} 個單字標記、學習設定、個人筆記${Array.isArray(progress.quizHistory) ? "與測驗紀錄" : ""}。`,
      });
    } catch (error) {
      setBackupFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "匯入失敗，請確認選擇正確的備份檔。",
      });
    }
  }

  if (!loaded) {
    return <main className="loading-screen"><span className="loader" />正在整理今日詞彙…</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="回到今日單字頂端">
          <span className="brand-mark">V</span>
          <span><strong>詞序 VocabFlow</strong><small>高中英文每日學習</small></span>
        </a>
        <div className="top-actions">
          <button className="quiz-launch-button" onClick={() => setQuizOpen(true)}>✦ 單字測驗</button>
          <button className="primary-button" onClick={() => setSettingsOpen(true)}>⚙ 學習設定</button>
        </div>
      </header>

      <div className="page" id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR DAILY VOCABULARY</p>
            <h1>今天，再前進 <span>{dayWords.length}</span> 個單字。</h1>
            <p>每天混合第 1–6 級與不同字首；完成標記會自動保存在這台裝置。</p>
          </div>
          <div className="day-controls">
            <div className="day-switcher" aria-label="切換學習天數">
              <button onClick={() => changeDay(safeDay - 1)} disabled={safeDay <= 1} aria-label="前一天">←</button>
              <div><small>目前進度</small><strong>Day {safeDay} <span>/ {totalDays}</span></strong></div>
              <button onClick={() => changeDay(safeDay + 1)} disabled={safeDay >= totalDays} aria-label="後一天">→</button>
            </div>
            <div className="date-jump">
              <label htmlFor="learning-date">直接選擇日期</label>
              <input
                id="learning-date"
                type="date"
                min={startDate}
                max={planEndDate}
                value={selectedLearningDate}
                onChange={(event) => changeLearningDate(event.target.value)}
              />
              <button type="button" onClick={() => changeLearningDate(currentLocalDate())}>今天</button>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="progress-card">
            <div className="progress-heading">
              <div><span>今日完成度</span><strong>{dayDone} / {dayWords.length}</strong></div>
              <b>{progress}%</b>
            </div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <p>{formatDate(startDate, safeDay - 1)} · 第 {safeDay} 天學習內容</p>
          </div>
          <div className="stat-card known"><span>✓</span><div><small>已熟悉</small><strong>{allCounts.known}</strong></div></div>
          <div className="stat-card review"><span>↻</span><div><small>待複習</small><strong>{allCounts.review}</strong></div></div>
          <div className="stat-card unknown"><span>!</span><div><small>不熟</small><strong>{allCounts.unknown}</strong></div></div>
        </section>

        <section className="toolbar">
          <label className="search-box">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋全部 6,004 詞條（英文或中文）" />
            {query && <button onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
          </label>
          <select value={levelFilter} onChange={(e) => setLevelFilter(Number(e.target.value))} aria-label="依官方級別篩選">
            <option value={0}>全部級別</option>
            {[1,2,3,4,5,6].map((level) => <option key={level} value={level}>第 {level} 級</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="依學習狀態篩選">
            <option value="all">全部狀態</option>
            <option value="known">已熟悉</option>
            <option value="review">待複習</option>
            <option value="unknown">不熟</option>
            <option value="unmarked">未標記</option>
          </select>
          <button className="speech-mode" onClick={() => setSpeechSpeed(nextSpeechSpeed)} aria-label="切換朗讀速度">
            <span>▶</span>朗讀：{speechSpeed === "ultraSlow" ? "超慢速" : speechSpeed === "slow" ? "慢速" : "正常"}
          </button>
        </section>

        <div className="list-heading">
          <div><p>{query ? "全表搜尋結果" : `DAY ${safeDay} · TODAY'S WORDS`}</p><h2>{query ? `找到 ${filteredWords.length}${filteredWords.length === 120 ? "+" : ""} 筆` : "今日單字"}</h2></div>
          <p className="sorting-note">每日六級平均混合 · 固定 50 詞</p>
        </div>

        <section className="word-grid" aria-live="polite">
          {filteredWords.map((word) => {
            const status = statuses[word.id];
            const dayRank = words.indexOf(word) % WORDS_PER_DAY + 1;
            return (
              <article className={`word-card ${status ? `is-${status}` : ""}`} key={word.id}>
                <div className="card-topline">
                  <span className="rank">#{dayRank} 本日順序</span>
                  <span className={`level level-${word.level}`}>LEVEL {word.level}</span>
                </div>
                <div className="word-line">
                  <div><h3>{word.word}</h3><p>{word.pos} <span>{word.phonetic && `/ ${word.phonetic} /`}</span></p></div>
                  <button className="speak-button" onClick={() => speak(word.word, "en-US", speechSpeed)} aria-label={`朗讀 ${word.word}`}>▶<small>EN</small></button>
                </div>
                <div className="meaning">
                  <div className="meaning-groups">
                    {parseMeaningGroups(word.meaning, word.pos).map((group) => (
                      <div className="meaning-group" key={group.key}>
                        <div className={`meaning-pos pos-${group.abbreviation.replace(".", "") || "general"}`}>
                          <span>{group.label}</span>
                          {group.sourceField && <small>[{group.sourceField}]</small>}
                        </div>
                        <p className="meaning-senses">
                          {group.senses.map((sense, index) => <span key={`${sense}-${index}`}>{index > 0 && "、"}{sense}</span>)}
                        </p>
                        {group.supplements.map((supplement) => (
                          <p className="meaning-supplement" key={`${supplement.field}-${supplement.senses.join("-")}`}>
                            <span>[{supplement.field}]</span> {supplement.senses.join("、")}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {word.note && <p className="note">備註：{word.note}</p>}
                <div className="status-actions" role="group" aria-label={`${word.word} 的熟悉度`}>
                  {(Object.keys(statusMeta) as WordStatus[]).map((key) => (
                    <button key={key} className={status === key ? "active" : ""} onClick={() => mark(word.id, key)}>
                      <span>{statusMeta[key].icon}</span>{statusMeta[key].label}
                    </button>
                  ))}
                </div>
                <WordDetails
                  wordId={word.id}
                  word={word.word}
                  family={familyMap.get(word.id) ?? []}
                  records={enrichmentMap.get(word.id) ?? []}
                  aiData={aiEnrichment[String(word.id)]}
                  aiMeta={aiEnrichmentMeta}
                  aiGlosses={aiGlosses}
                  examples={bilingualExamples[String(word.id)] ?? []}
                  personalNote={wordNotes[word.id] ?? ""}
                  onNoteChange={updateWordNote}
                />
              </article>
            );
          })}
          {!filteredWords.length && <div className="empty-state"><span>⌕</span><h3>沒有符合條件的單字</h3><p>試著清除搜尋文字或調整篩選條件。</p></div>}
        </section>

        {!query && (
          <nav className="bottom-nav" aria-label="前後天切換">
            <button onClick={() => changeDay(safeDay - 1)} disabled={safeDay <= 1}>← 前一天</button>
            <span>Day {safeDay} / {totalDays}</span>
            <button onClick={() => changeDay(safeDay + 1)} disabled={safeDay >= totalDays}>後一天 →</button>
          </nav>
        )}

        <aside className="source-banner">
          <span>i</span>
          <div><strong>為什麼不是剛好 7,000 個？</strong><p>「高中 7,000 單字」是常見俗稱；本網站採用大考中心 111 學年度起適用版本，共 6,004 個官方詞條。</p></div>
          <button onClick={() => setInfoOpen(true)}>查看資料說明 →</button>
        </aside>

        <footer className="site-footer">
          <p>© 2026 zozo971209-pixel · 網站程式、介面與編排保留所有權利。</p>
          <p>詞彙及字典資料的權利屬原資料提供者，詳見 <a href={`${BASE_PATH}/RIGHTS.md`} target="_blank" rel="noreferrer">權利說明</a> 與 <a href="https://github.com/zozo971209-pixel/vocabflow-6004" target="_blank" rel="noreferrer">GitHub 原始專案</a>。</p>
        </footer>
      </div>

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">LEARNING PLAN</p><h2 id="settings-title">調整學習計畫</h2>
            <div className="fixed-setting"><span>每天單字數</span><strong>固定 50 詞</strong><small>因總數為 6,004，第 121 天是最後 4 詞。</small></div>
            <label><span>目前天數 <small>1–{totalDays}</small></span><input type="number" min="1" max={totalDays} value={safeDay} onChange={(e) => changeDay(Number(e.target.value))} /></label>
            <label><span>學習起始日</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label>
              <span>目前學習日期 <small>可直接跳到指定日期</small></span>
              <div className="modal-date-row">
                <input type="date" min={startDate} max={planEndDate} value={selectedLearningDate} onChange={(e) => changeLearningDate(e.target.value)} />
                <button type="button" onClick={() => changeLearningDate(currentLocalDate())}>今天</button>
              </div>
            </label>
            <div className="plan-summary"><strong>{words.length.toLocaleString()} 個詞條 · 每天 50 個</strong><span>共 {totalDays} 天完成</span></div>
            <section className="setting-section" aria-labelledby="appearance-title">
              <div><strong id="appearance-title">外觀與閱讀</strong><p>設定只儲存在這台裝置。</p></div>
              <span className="setting-label">顯示主題</span>
              <div className="segmented-control" role="group" aria-label="顯示主題">
                <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>亮色</button>
                <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>深色</button>
              </div>
              <span className="setting-label">字體大小</span>
              <div className="segmented-control three" role="group" aria-label="字體大小">
                {(["small", "normal", "large"] as FontSizeMode[]).map((size) => (
                  <button key={size} className={fontSize === size ? "active" : ""} onClick={() => setFontSize(size)}>
                    {{ small: "小", normal: "標準", large: "大" }[size]}
                  </button>
                ))}
              </div>
            </section>
            <section className="setting-section pwa-panel" aria-labelledby="pwa-title">
              <div><strong id="pwa-title">安裝與完整離線使用</strong><p>先在線上開啟一次，網站與 6,004 詞資料會快取至裝置；之後無網路仍可學習、測驗與寫筆記。</p></div>
              <button type="button" className="backup-button export" onClick={installPwa}>＋ 安裝到裝置</button>
              {pwaFeedback && <p className="backup-feedback" role="status">{pwaFeedback}</p>}
            </section>
            <section className="backup-panel" aria-labelledby="backup-title">
              <div><strong id="backup-title">進度備份與換機轉移</strong><p>舊手機先匯出，新手機再匯入；檔案包含單字標記、學習設定、個人筆記與測驗紀錄，不會上傳到伺服器。</p></div>
              <div className="backup-actions">
                <button type="button" className="backup-button export" onClick={exportProgress}>↓ 匯出進度</button>
                <button type="button" className="backup-button import" onClick={() => importInputRef.current?.click()}>↑ 匯入進度</button>
                <input ref={importInputRef} className="hidden-file-input" type="file" accept=".json,application/json" onChange={importProgress} />
              </div>
              {backupFeedback && <p className={`backup-feedback ${backupFeedback.type}`} role="status">{backupFeedback.text}</p>}
            </section>
            <button className="primary-button full" onClick={() => setSettingsOpen(false)}>儲存並返回學習</button>
          </section>
        </div>
      )}

      {infoOpen && (
        <div className="modal-backdrop" onMouseDown={() => setInfoOpen(false)}>
          <section className="modal info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInfoOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">ABOUT THE DATA</p><h2 id="info-title">資料範圍與排序方式</h2>
            <div className="info-block"><strong>6,004 個官方詞條</strong><p>英文詞彙、詞性與六級分級來自大學入學考試中心《高中英文參考詞彙表（111學年度起適用）》。</p></div>
            <div className="info-block"><strong>中文不是大考中心官方翻譯</strong><p>中文釋義與音標由原 Excel 中的開源 ECDICT 英漢字典資料補充。</p></div>
            <div className="info-block"><strong>字義依用途分類，不標主次</strong><p>中文解釋依詞性分組，法律、醫學、化學、電腦等專業補充另列；不再以粗體推測哪個意思較常用。</p></div>
            <div className="info-block"><strong>6,004 詞皆有完整雙語例句</strong><p>優先使用經嚴格篩選的 Tatoeba 英中句對；缺漏詞條由本機 AI 依主要詞義補句並通過格式檢查。粗體只標示句中的英文目標詞與中文對應詞，AI 補句會另行標示。</p></div>
            <div className="info-block"><strong>每日混合六級與不同字首</strong><p>每天固定安排 50 詞，第 1–6 級各約 8–9 詞，並分散不同英文字母開頭；卡片的 1–50 是當日學習順序。因官方總數為 6,004，第 121 天是剩餘的最後 4 詞。</p></div>
            <a className="source-link" href="https://www.ceec.edu.tw/files/file_pool/1/0k213571061045122620/%E9%AB%98%E4%B8%AD%E8%8B%B1%E6%96%87%E5%8F%83%E8%80%83%E8%A9%9E%E5%BD%99%E8%A1%A8%28111%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%E9%81%A9%E7%94%A8%29.pdf" target="_blank" rel="noreferrer">查看大考中心原始詞彙表 ↗</a>
          </section>
        </div>
      )}

      {quizOpen && (
        <QuizModal
          words={words}
          currentDay={safeDay}
          totalDays={totalDays}
          statuses={statuses}
          history={quizHistory}
          onComplete={(entry) => setQuizHistory((current) => [entry, ...current].slice(0, 50))}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </main>
  );
}
