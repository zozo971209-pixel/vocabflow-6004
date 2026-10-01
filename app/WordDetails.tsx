"use client";

import { irregularFormFor } from "./wordEnhancements";
import { EnrichmentCategory, VerifiedEnrichmentRecord } from "./enrichment";
import { AiEnrichmentWord } from "./aiEnrichment";
import { BilingualExample } from "./bilingualExamples";
import { SourceExample } from "./sourceExamples";
import { CanonicalExample } from "./canonicalExamples";
import { contentEditorial, editedEnrichment } from "./contentEditorial";

type Props = {
  wordId: number;
  word: string;
  family: string[];
  records: VerifiedEnrichmentRecord[];
  aiData?: AiEnrichmentWord;
  aiGlosses: Record<string, string>;
  examples: BilingualExample[];
  sourceExamples: SourceExample[];
  canonicalExamples: CanonicalExample[];
  personalNote: string;
  onNoteChange: (wordId: number, note: string) => void;
};

function VerifiedItems({ records }: { records: VerifiedEnrichmentRecord[] }) {
  if (!records.length) return null;
  return <div className="verified-list">{records.map((record) => (
    <article className="verified-item" key={record.recordId}>
      <div className="verified-heading"><span className="verified-badge">✓ 人工核對</span>{record.senseZh && <small>{record.senseZh}</small>}</div>
      {record.category === "example"
        ? <p>{record.exampleEn}<br />{record.exampleZh}</p>
        : <p><strong>{record.contentEn}</strong>{record.contentZh && <> — {record.contentZh}</>}</p>}
      <p className="verified-source">
        來源：<a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceTitle}</a>
        {record.sourceLocation && ` · ${record.sourceLocation}`} · {record.sourceLicense}<br />
        核對：{record.reviewer} · {record.verifiedAt}
      </p>
    </article>
  ))}</div>;
}

function glossKey(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function AiList({ items, emptyText, glosses, notes }: { items?: string[]; emptyText: string; glosses?: (key: string) => string | undefined; notes?: Record<string, string> }) {
  if (!items?.length) return <p className="detail-empty">{emptyText}</p>;
  return <ul className="ai-detail-list">{items.map((item) => {
    const gloss = glosses?.(glossKey(item));
    return <li key={item}><span>{item}</span>{gloss ? <small>— {gloss}</small> : null}{notes?.[item] && <small className="synonym-distinction">用法差異：{notes[item]}</small>}</li>;
  })}</ul>;
}

function verifiedFor(records: VerifiedEnrichmentRecord[], categories: EnrichmentCategory[]) {
  return records.filter((record) => categories.includes(record.category));
}

function HighlightedText({ text, start, end }: { text: string; start: number; end: number }) {
  if (start < 0 || end <= start || end > text.length) return text;
  return <>{text.slice(0, start)}<strong className="example-target">{text.slice(start, end)}</strong>{text.slice(end)}</>;
}

function sourceForExample(example: BilingualExample | SourceExample) {
  if (example.sourceType === "open-wordnet") {
    return { label: "Open English Wordnet · CC BY 4.0", className: "example-source-open", url: example.sourceUrl ?? "https://en-word.net/" };
  }
  const id = "englishSentenceId" in example ? example.englishSentenceId : undefined;
  return { label: "Tatoeba · CC BY 2.0 FR", className: "example-source-tatoeba", url: example.sourceUrl ?? (id ? `https://tatoeba.org/en/sentences/show/${id}` : "https://tatoeba.org/") };
}

function sourceTargetSpan(example: SourceExample) {
  const start = example.en.toLowerCase().indexOf(example.targetEn.toLowerCase());
  return { start, end: start >= 0 ? start + example.targetEn.length : -1 };
}

function findTargetSpan(text: string, forms: string[]) {
  const candidates = [...forms].sort((a, b) => b.length - a.length);
  for (const form of candidates) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i").exec(text);
    if (match) return { start: match.index, end: match.index + match[0].length };
  }
  return { start: -1, end: -1 };
}

function findMeaningSpan(text: string, meaning: string) {
  const candidates = meaning.split(/[；;]/).map((item) => item.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    const start = text.indexOf(candidate);
    if (start >= 0) return { start, end: start + candidate.length };
  }
  return { start: -1, end: -1 };
}

export default function WordDetails({ wordId, word, family, records, aiData: originalAiData, aiGlosses: originalGlosses, examples: originalExamples, sourceExamples, canonicalExamples, personalNote, onNoteChange }: Props) {
  const aiData = editedEnrichment(wordId, originalAiData);
  const sourceBackedExamples = originalExamples.filter((example) =>
    (example.sourceType === "tatoeba" || example.sourceType === "open-wordnet") && example.qualityScore >= 40,
  );
  const aiGlosses = (key: string) => aiData?.glosses?.[key] ?? originalGlosses[key];
  const irregular = irregularFormFor(word);
  const verifiedFamily = records.filter((record) => record.category === "word_family");
  const verifiedIrregular = records.filter((record) => record.category === "irregular_form");
  const combinedFamily = [...new Set([...(aiData?.family ?? []), ...(contentEditorial[wordId] ? [] : family)])].filter((item) => item.toLowerCase() !== word.toLowerCase());
  const combinedForms = [...new Set([...(irregular ? [irregular] : []), ...(aiData?.forms ?? [])])];

  return (
    <details className="word-details">
      <summary><span>延伸學習與筆記</span><small>點擊展開</small></summary>
      <div className="word-details-content">
        <section>
          <h4>詞族整理</h4>
          <VerifiedItems records={verifiedFamily} />
          <AiList items={combinedFamily} emptyText="目前沒有找到可直接對應的詞族。" glosses={aiGlosses} />
        </section>
        <section>
          <h4>詞形與不規則變化</h4>
          <VerifiedItems records={verifiedIrregular} />
          <AiList items={combinedForms} emptyText="未收錄特殊詞形，或此詞不適用。" />
        </section>
        <section>
          <h4>搭配詞與句型練習</h4>
          <VerifiedItems records={verifiedFor(records, ["collocation"])} />
          <p className="detail-label">搭配詞</p>
          <AiList items={aiData?.collocations} emptyText="目前沒有可用的短搭配詞。" glosses={aiGlosses} />
          {aiData?.sentencePatterns?.length ? <>
            <p className="detail-label">句型練習</p>
            <AiList items={aiData.sentencePatterns} emptyText="目前沒有可用的句型練習。" glosses={aiGlosses} />
          </> : null}
        </section>
        <section>
          <h4>片語、複合詞與固定用法</h4>
          <VerifiedItems records={verifiedFor(records, ["fixed_phrase"])} />
          <AiList items={aiData?.phrases} emptyText="未收錄可直接對應的固定片語；不代表此詞沒有其他搭配。" glosses={aiGlosses} />
        </section>
        <section>
          <h4>例句與用法</h4>
          <VerifiedItems records={verifiedFor(records, ["example"])} />
          {canonicalExamples.length ? <div className="ai-example-list canonical-example-list">{canonicalExamples.map((example) => {
            const enSpan = findTargetSpan(example.en, example.targetForms);
            const zhSpan = findMeaningSpan(example.zh, example.meaning);
            return <p key={example.senseId}>
              <small className="canonical-sense-label">{example.pos} · {example.meaning}</small>
              <small className="canonical-sense-explanation">{example.explanation}</small>
              <span className="example-english"><HighlightedText text={example.en} start={enSpan.start} end={enSpan.end} /></span>
              <small className="example-translation"><HighlightedText text={example.zh} start={zhSpan.start} end={zhSpan.end} /></small>
            </p>;
          })}</div> : sourceBackedExamples.length ? <div className="ai-example-list">{sourceBackedExamples.map((example) => {
            const source = sourceForExample(example);
            return <p key={example.englishSentenceId ? `${example.englishSentenceId}-${example.chineseSentenceId}` : `${wordId}-${example.en}`}>
              <span className="example-english"><HighlightedText text={example.en} start={example.enStart} end={example.enEnd} /></span>
              <small className="example-translation"><HighlightedText text={example.zh} start={example.zhStart} end={example.zhEnd} /></small>
              <small className={`example-source ${source.className}`}>來源：{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</small>
            </p>;
          })}</div> : <p className="detail-empty">目前沒有可用例句。</p>}
          {sourceExamples.length ? <div className="source-example-list"><p className="detail-label">專業來源英文用例</p>{sourceExamples.map((example) => {
            const span = sourceTargetSpan(example);
            const source = sourceForExample(example);
            return <p className="source-example-item" key={`${wordId}-${example.en}`}>
              <span className="example-english"><HighlightedText text={example.en} start={span.start} end={span.end} /></span>
              <small className="source-example-kind">{example.exampleKind === "sentence" ? "完整句" : "詞典用例片語"}</small>
              <small className="source-translation-note">中文翻譯未隨 Wordnet 原始資料提供；保留英文原文，避免自動翻譯冒充來源內容。</small>
              <small className={`example-source ${source.className}`}>來源：<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></small>
            </p>;
          })}</div> : null}
        </section>
        <section>
          <h4>同義詞與反義詞</h4>
          <VerifiedItems records={verifiedFor(records, ["synonym", "antonym"])} />
          <p className="detail-label">同義詞</p>
          <AiList items={aiData?.synonyms} emptyText="未收錄可直接對應的同義詞。" glosses={aiGlosses} notes={aiData?.synonymNotes} />
          {Boolean(aiData?.synonyms.length) && !aiData?.synonymNotes && <p className="detail-empty">這些詞只在部分詞義下相近，不保證能在每個句子互換；逐詞用法差異尚待整理。</p>}
          <p className="detail-label">反義詞</p>
          <AiList items={aiData?.antonyms} emptyText="未收錄直接反義詞。" glosses={aiGlosses} />
        </section>
        <section>
          <h4>用法標記（可數／不可數）</h4>
          <VerifiedItems records={verifiedFor(records, ["countability"])} />
          <AiList items={aiData?.usage} emptyText="目前沒有可用的用法標記。" />
        </section>
        <label className="personal-note">
          <span>個人筆記與記憶法</span>
          <textarea
            value={personalNote}
            maxLength={500}
            placeholder="例如：自己的聯想、老師補充、易混淆字……"
            onChange={(event) => onNoteChange(wordId, event.target.value)}
          />
          <small>{personalNote.length} / 500</small>
        </label>
      </div>
    </details>
  );
}
