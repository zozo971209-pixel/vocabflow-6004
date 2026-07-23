"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Word = {
  id: number;
  level: number;
  word: string;
  pos: string;
  phonetic: string;
  meaning: string;
  note: string;
};

type WordStatus = "known" | "review" | "unknown";
type StatusMap = Record<number, WordStatus>;
type SpeechSpeed = "slow" | "normal";
type BackupFeedback = { type: "success" | "error"; text: string } | null;

const STORAGE_KEY = "vocab6004-progress-v1";
const SETTINGS_KEY = "vocab6004-settings-v1";
const WORDS_PER_DAY = 50;
const BASE_PATH = "/vocabflow-6004";
const today = new Date().toISOString().slice(0, 10);

const statusMeta: Record<WordStatus, { label: string; icon: string }> = {
  known: { label: "已熟悉", icon: "✓" },
  review: { label: "待複習", icon: "↻" },
  unknown: { label: "不熟", icon: "!" },
};

function cleanSpeechText(text: string, lang: "en-US" | "zh-TW") {
  if (lang === "en-US") {
    if (text.trim().toLowerCase() === "a/an") return "a book. an apple.";
    return text
      .replace(/\//g, " or ")
      .replace(/&/g, " and ")
      .replace(/[()[\]{}*_~|\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return text
    .replace(/\[[^\]]+\]/g, "")
    .replace(/^\s*(?:vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num)\.\s*/gim, "")
    .replace(/[\/\\|*_~]/g, "，")
    .replace(/\s+/g, " ")
    .trim();
}

function speak(text: string, lang: "en-US" | "zh-TW", speed: SpeechSpeed) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text, lang));
  utterance.lang = lang;
  utterance.rate = speed === "slow"
    ? (lang === "en-US" ? 0.68 : 0.78)
    : (lang === "en-US" ? 0.82 : 0.92);
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
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>("slow");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WordStatus | "unmarked">("all");
  const [levelFilter, setLevelFilter] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<BackupFeedback>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/vocab.json`).then((res) => res.json()),
      Promise.resolve(localStorage.getItem(STORAGE_KEY)),
      Promise.resolve(localStorage.getItem(SETTINGS_KEY)),
    ]).then(([data, savedStatuses, savedSettings]) => {
      setWords(data as Word[]);
      if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setCurrentDay(settings.currentDay ?? 1);
        setStartDate(settings.startDate ?? today);
        setSpeechSpeed(settings.speechSpeed ?? "slow");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currentDay, startDate, speechSpeed }));
  }, [currentDay, startDate, speechSpeed, loaded]);

  const totalDays = Math.max(1, Math.ceil(words.length / WORDS_PER_DAY));
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

  function exportProgress() {
    const backup = {
      format: "vocabflow-progress",
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "詞序 VocabFlow",
      progress: {
        statuses,
        settings: { currentDay: safeDay, startDate, speechSpeed },
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
      if (typeof rawDay !== "number" || !Number.isFinite(rawDay) ||
          typeof rawStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawStartDate) ||
          (rawSpeed !== "slow" && rawSpeed !== "normal")) {
        throw new Error("備份檔中的學習設定格式不正確。");
      }

      setStatuses(nextStatuses);
      setCurrentDay(Math.max(1, Math.min(totalDays, Math.round(rawDay))));
      setStartDate(rawStartDate);
      setSpeechSpeed(rawSpeed);
      setBackupFeedback({
        type: "success",
        text: `匯入完成，已恢復 ${Object.keys(nextStatuses).length} 個單字標記與學習設定。`,
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
          <button className="quiet-button" onClick={() => setInfoOpen(true)}>資料說明</button>
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
          <button className="speech-mode" onClick={() => setSpeechSpeed((value) => value === "slow" ? "normal" : "slow")} aria-label="切換朗讀速度">
            <span>▶</span>朗讀：{speechSpeed === "slow" ? "慢速" : "正常"}
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
                  <p>{word.meaning}</p>
                  <button className="speak-link" onClick={() => speak(word.meaning, "zh-TW", speechSpeed)}>▶ 中文朗讀</button>
                </div>
                {word.note && <p className="note">備註：{word.note}</p>}
                <div className="status-actions" role="group" aria-label={`${word.word} 的熟悉度`}>
                  {(Object.keys(statusMeta) as WordStatus[]).map((key) => (
                    <button key={key} className={status === key ? "active" : ""} onClick={() => mark(word.id, key)}>
                      <span>{statusMeta[key].icon}</span>{statusMeta[key].label}
                    </button>
                  ))}
                </div>
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
            <section className="backup-panel" aria-labelledby="backup-title">
              <div><strong id="backup-title">進度備份與換機轉移</strong><p>舊手機先匯出，新手機再匯入；檔案包含單字標記與學習設定，不會上傳到伺服器。</p></div>
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
            <div className="info-block"><strong>每日混合六級與不同字首</strong><p>每天固定安排 50 詞，第 1–6 級各約 8–9 詞，並分散不同英文字母開頭；卡片的 1–50 是當日學習順序。因官方總數為 6,004，第 121 天是剩餘的最後 4 詞。</p></div>
            <a className="source-link" href="https://www.ceec.edu.tw/files/file_pool/1/0k213571061045122620/%E9%AB%98%E4%B8%AD%E8%8B%B1%E6%96%87%E5%8F%83%E8%80%83%E8%A9%9E%E5%BD%99%E8%A1%A8%28111%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%E9%81%A9%E7%94%A8%29.pdf" target="_blank" rel="noreferrer">查看大考中心原始詞彙表 ↗</a>
          </section>
        </div>
      )}
    </main>
  );
}
