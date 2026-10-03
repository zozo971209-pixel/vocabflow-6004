"use client";

import { useEffect, useState } from "react";
import { parseMeaningGroups } from "./meaningGroups";
import type { QuizWordStatus } from "./QuizModal";

type FocusWord = {
  id: number;
  level: number;
  word: string;
  pos: string;
  phonetic: string;
  meaning: string;
  primaryMeanings?: string[];
};

type Props = {
  words: FocusWord[];
  statuses: Record<number, QuizWordStatus>;
  favorites: Set<number>;
  onMark: (id: number, status: QuizWordStatus) => void;
  onFavorite: (id: number) => void;
  onSpeak: (word: string) => void;
  onClose: () => void;
};

const statusLabels: Record<QuizWordStatus, string> = {
  known: "已熟悉",
  review: "待複習",
  unknown: "不熟",
};

export default function FocusStudy({ words, statuses, favorites, onMark, onFavorite, onSpeak, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const word = words[index];

  function move(next: number) {
    setIndex(Math.max(0, Math.min(words.length - 1, next)));
    setRevealed(false);
  }

  function mark(status: QuizWordStatus) {
    if (!word) return;
    onMark(word.id, status);
    if (index < words.length - 1) move(index + 1);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") onClose();
      if (event.key === " " && word) { event.preventDefault(); setRevealed(value => !value); }
      if (event.key === "ArrowLeft") move(index - 1);
      if (event.key === "ArrowRight") move(index + 1);
      if (revealed && event.key === "1") mark("known");
      if (revealed && event.key === "2") mark("review");
      if (revealed && event.key === "3") mark("unknown");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!word) return null;
  const groups = parseMeaningGroups(word.meaning, word.pos);

  return (
    <div className="focus-backdrop">
      <section className="focus-study" role="dialog" aria-modal="true" aria-labelledby="focus-word">
        <header className="focus-header">
          <div><strong>專注學習</strong><span>{index + 1} / {words.length}</span></div>
          <button onClick={onClose} aria-label="關閉專注學習">×</button>
        </header>
        <div className="focus-track"><i style={{ width: `${((index + 1) / words.length) * 100}%` }} /></div>
        <div className="focus-card">
          <div className="focus-meta"><span>LEVEL {word.level}</span><button className={favorites.has(word.id) ? "active" : ""} onClick={() => onFavorite(word.id)} aria-label={favorites.has(word.id) ? "取消收藏" : "加入收藏"}>★</button></div>
          <h2 id="focus-word">{word.word}</h2>
          <p className="focus-pronunciation">{word.pos} · {word.phonetic}</p>
          <button className="focus-speak" onClick={() => onSpeak(word.word)}>▶ 朗讀英文</button>
          {!revealed ? (
            <button className="focus-reveal" onClick={() => setRevealed(true)}>顯示中文意思</button>
          ) : (
            <div className="focus-answer">
              {groups.map(group => (
                <div key={group.key}><strong>{group.label}</strong><p>{group.senses.join("、")}</p></div>
              ))}
            </div>
          )}
        </div>
        {revealed && (
          <div className="focus-status" role="group" aria-label={`${word.word} 的熟悉度`}>
            {(["known", "review", "unknown"] as QuizWordStatus[]).map((status, statusIndex) => (
              <button key={status} className={`${status} ${statuses[word.id] === status ? "active" : ""}`} onClick={() => mark(status)}><small>{statusIndex + 1}</small>{statusLabels[status]}</button>
            ))}
          </div>
        )}
        <footer className="focus-navigation">
          <button onClick={() => move(index - 1)} disabled={index === 0}>← 上一個</button>
          <span>空白鍵顯示答案 · 1／2／3 標記</span>
          <button onClick={() => move(index + 1)} disabled={index === words.length - 1}>下一個 →</button>
        </footer>
      </section>
    </div>
  );
}
