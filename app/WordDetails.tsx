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

function LearningList({ items, glosses, notes }: { items?: string[]; glosses?: (key: string) => string | undefined; notes?: Record<string, string> }) {
  if (!items?.length) return null;
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

function isTeachingPattern(value: string) {
  return /(?:\+|sb\.?|sth\.?|somebody|something|to-infinitive|-ing|that-clause|wh-clause|object|subject)/i.test(value);
}

export default function WordDetails({ wordId, word, family, records, aiData: originalAiData, aiGlosses: originalGlosses, examples: originalExamples, canonicalExamples, personalNote, onNoteChange }: Props) {
  const aiData = editedEnrichment(wordId, originalAiData);
  const sourceBackedExamples = originalExamples.filter((example) =>
    (example.sourceType === "tatoeba" || example.sourceType === "open-wordnet") && example.qualityScore >= 40,
  );
  const aiGlosses = (key: string) => aiData?.glosses?.[key] ?? originalGlosses[key];
  const irregular = irregularFormFor(word);
  const verifiedFamily = records.filter((record) => record.category === "word_family");
  const verifiedIrregular = records.filter((record) => record.category === "irregular_form");
  const combinedFamily = [...new Set(contentEditorial[wordId] ? (aiData?.family ?? []) : family)].filter((item) => item.toLowerCase() !== word.toLowerCase());
  const combinedForms = [...new Set([...(irregular ? [irregular] : []), ...(aiData?.forms ?? [])])];
  const sentencePatterns = (aiData?.sentencePatterns ?? []).filter(isTeachingPattern);
  const synonyms = (aiData?.synonyms ?? []).filter(item => Boolean(aiData?.synonymNotes?.[item]));
  const usage = (aiData?.usage ?? []).filter(item => !/Open English WordNet|可數性可能隨詞義與語境改變/.test(item));
  const relatedRecordCount = records.filter(record => record.category !== "example").length;
  const hasRelatedContent = relatedRecordCount > 0 || combinedFamily.length > 0 || combinedForms.length > 0 || Boolean(
    aiData?.collocations?.length || sentencePatterns.length || aiData?.phrases?.length ||
    synonyms.length || usage.length,
  );

  return (
    <details className="word-details">
      <summary><span>例句、搭配與筆記</span><small>{canonicalExamples.length ? `${canonicalExamples.length} 個例句` : "展開學習"}</small></summary>
      <div className="word-details-content">
        <section className="example-panel">
          <h4>例句與用法</h4>
          <VerifiedItems records={verifiedFor(records, ["example"])} />
          {canonicalExamples.length ? <div className="ai-example-list canonical-example-list">{canonicalExamples.map((example) => {
            const enSpan = findTargetSpan(example.en, example.targetForms);
            const zhSpan = findMeaningSpan(example.zh, example.meaning);
            return <p key={example.senseId}>
              <small className="canonical-sense-label">{example.pos} · {example.meaning}</small>
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
        </section>
        {hasRelatedContent && <details className="detail-group">
          <summary>搭配與相關詞</summary>
          <div className="detail-group-content">
            {(verifiedFamily.length > 0 || combinedFamily.length > 0) && <section><h4>詞族整理</h4><VerifiedItems records={verifiedFamily} /><LearningList items={combinedFamily} glosses={aiGlosses} /></section>}
            {(verifiedIrregular.length > 0 || combinedForms.length > 0) && <section><h4>詞形與不規則變化</h4><VerifiedItems records={verifiedIrregular} /><LearningList items={combinedForms} /></section>}
            {(verifiedFor(records, ["collocation"]).length > 0 || aiData?.collocations?.length || sentencePatterns.length > 0) ? <section><h4>搭配詞與句型</h4><VerifiedItems records={verifiedFor(records, ["collocation"])} />{aiData?.collocations?.length ? <><p className="detail-label">搭配詞</p><LearningList items={aiData.collocations} glosses={aiGlosses} /></> : null}{sentencePatterns.length ? <><p className="detail-label">句型</p><LearningList items={sentencePatterns} glosses={aiGlosses} /></> : null}</section> : null}
            {(verifiedFor(records, ["fixed_phrase"]).length > 0 || aiData?.phrases?.length) ? <section><h4>片語與固定用法</h4><VerifiedItems records={verifiedFor(records, ["fixed_phrase"])} /><LearningList items={aiData?.phrases} glosses={aiGlosses} /></section> : null}
            {(verifiedFor(records, ["synonym", "antonym"]).length > 0 || synonyms.length > 0) ? <section><h4>同義詞與反義詞</h4><VerifiedItems records={verifiedFor(records, ["synonym", "antonym"])} />{synonyms.length ? <><p className="detail-label">同義詞</p><LearningList items={synonyms} glosses={aiGlosses} notes={aiData?.synonymNotes} /></> : null}</section> : null}
            {(verifiedFor(records, ["countability"]).length > 0 || usage.length > 0) ? <section><h4>用法標記</h4><VerifiedItems records={verifiedFor(records, ["countability"])} /><LearningList items={usage} /></section> : null}
          </div>
        </details>}
        <details className="detail-group note-group" open={Boolean(personalNote)}>
          <summary>{personalNote ? "我的筆記（已儲存）" : "新增我的筆記"}</summary>
          <label className="personal-note">
            <span>個人筆記與記憶法</span>
            <textarea value={personalNote} maxLength={500} placeholder="例如：自己的聯想、老師補充、易混淆字……" onChange={(event) => onNoteChange(wordId, event.target.value)} />
            <small>{personalNote.length} / 500</small>
          </label>
        </details>
      </div>
    </details>
  );
}
