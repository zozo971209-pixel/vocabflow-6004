"use client";

import { useEffect, useMemo, useState } from "react";

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

const STORAGE_KEY = "vocab6004-progress-v1";
const SETTINGS_KEY = "vocab6004-settings-v1";
const today = new Date().toISOString().slice(0, 10);

const statusMeta: Record<WordStatus, { label: string; icon: string }> = {
  known: { label: "已熟悉", icon: "✓" },
  review: { label: "待複習", icon: "↻" },
  unknown: { label: "不熟", icon: "!" },
};

function speak(text: string, lang: "en-US" | "zh-TW") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\[[^\]]+\]/g, ""));
  utterance.lang = lang;
  utterance.rate = lang === "en-US" ? 0.82 : 0.92;
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

export default function Home() {
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [wordsPerDay, setWordsPerDay] = useState(50);
  const [currentDay, setCurrentDay] = useState(1);
  const [startDate, setStartDate] = useState(today);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WordStatus | "unmarked">("all");
  const [levelFilter, setLevelFilter] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/vocab.json").then((res) => res.json()),
      Promise.resolve(localStorage.getItem(STORAGE_KEY)),
      Promise.resolve(localStorage.getItem(SETTINGS_KEY)),
    ]).then(([data, savedStatuses, savedSettings]) => {
      setWords(data as Word[]);
      if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setWordsPerDay(settings.wordsPerDay ?? 50);
        setCurrentDay(settings.currentDay ?? 1);
        setStartDate(settings.startDate ?? today);
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ wordsPerDay, currentDay, startDate }));
  }, [wordsPerDay, currentDay, startDate, loaded]);

  const totalDays = Math.max(1, Math.ceil(words.length / wordsPerDay));
  const safeDay = Math.min(currentDay, totalDays);
  const dayWords = useMemo(() => {
    const start = (safeDay - 1) * wordsPerDay;
    return words.slice(start, start + wordsPerDay);
  }, [words, wordsPerDay, safeDay]);

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
    }).slice(0, normalized ? 120 : wordsPerDay);
  }, [query, words, dayWords, statusFilter, levelFilter, statuses, wordsPerDay]);

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

  function applyWordsPerDay(value: number) {
    const next = Math.max(10, Math.min(100, value || 50));
    setWordsPerDay(next);
    setCurrentDay((day) => Math.min(day, Math.max(1, Math.ceil(words.length / next))));
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
            <p>按官方六級由淺入深安排；完成標記會自動保存在這台裝置。</p>
          </div>
          <div className="day-switcher" aria-label="切換學習天數">
            <button onClick={() => changeDay(safeDay - 1)} disabled={safeDay <= 1} aria-label="前一天">←</button>
            <div><small>目前進度</small><strong>Day {safeDay} <span>/ {totalDays}</span></strong></div>
            <button onClick={() => changeDay(safeDay + 1)} disabled={safeDay >= totalDays} aria-label="後一天">→</button>
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
        </section>

        <div className="list-heading">
          <div><p>{query ? "全表搜尋結果" : `DAY ${safeDay} · TODAY'S WORDS`}</p><h2>{query ? `找到 ${filteredWords.length}${filteredWords.length === 120 ? "+" : ""} 筆` : "今日單字"}</h2></div>
          <p className="sorting-note">難度依官方級別 1 → 6 排列</p>
        </div>

        <section className="word-grid" aria-live="polite">
          {filteredWords.map((word) => {
            const status = statuses[word.id];
            const dayRank = words.indexOf(word) % wordsPerDay + 1;
            return (
              <article className={`word-card ${status ? `is-${status}` : ""}`} key={word.id}>
                <div className="card-topline">
                  <span className="rank">#{dayRank} 本日順序</span>
                  <span className={`level level-${word.level}`}>LEVEL {word.level}</span>
                </div>
                <div className="word-line">
                  <div><h3>{word.word}</h3><p>{word.pos} <span>{word.phonetic && `/ ${word.phonetic} /`}</span></p></div>
                  <button className="speak-button" onClick={() => speak(word.word, "en-US")} aria-label={`朗讀 ${word.word}`}>▶<small>EN</small></button>
                </div>
                <div className="meaning">
                  <p>{word.meaning}</p>
                  <button className="speak-link" onClick={() => speak(word.meaning, "zh-TW")}>▶ 中文朗讀</button>
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
      </div>

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">LEARNING PLAN</p><h2 id="settings-title">調整學習計畫</h2>
            <label><span>每天單字數 <small>10–100</small></span><input type="number" min="10" max="100" value={wordsPerDay} onChange={(e) => applyWordsPerDay(Number(e.target.value))} /></label>
            <label><span>目前天數 <small>1–{totalDays}</small></span><input type="number" min="1" max={totalDays} value={safeDay} onChange={(e) => changeDay(Number(e.target.value))} /></label>
            <label><span>學習起始日</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <div className="plan-summary"><strong>{words.length.toLocaleString()} 個詞條 ÷ 每天 {wordsPerDay} 個</strong><span>預計 {totalDays} 天完成</span></div>
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
            <div className="info-block"><strong>由淺入深，不假裝精確</strong><p>網站先按官方第 1 級至第 6 級排序，同級內按英文排列。卡片的 1–50 是當日學習順序；官方級別是參考分級，不等同每個詞的絕對難度排名。</p></div>
            <a className="source-link" href="https://www.ceec.edu.tw/files/file_pool/1/0k213571061045122620/%E9%AB%98%E4%B8%AD%E8%8B%B1%E6%96%87%E5%8F%83%E8%80%83%E8%A9%9E%E5%BD%99%E8%A1%A8%28111%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%E9%81%A9%E7%94%A8%29.pdf" target="_blank" rel="noreferrer">查看大考中心原始詞彙表 ↗</a>
          </section>
        </div>
      )}
    </main>
  );
}
