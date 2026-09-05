"use client";

import { irregularFormFor } from "./wordEnhancements";
import { EnrichmentCategory, VerifiedEnrichmentRecord } from "./enrichment";
import { AiEnrichmentPayload, AiEnrichmentWord } from "./aiEnrichment";
import { BilingualExample } from "./bilingualExamples";
import { contentEditorial, editedEnrichment, editedExamples } from "./contentEditorial";

type Props = {
  wordId: number;
  word: string;
  family: string[];
  records: VerifiedEnrichmentRecord[];
  aiData?: AiEnrichmentWord;
  aiMeta: Pick<AiEnrichmentPayload, "notice" | "source"> | null;
  aiGlosses: Record<string, string>;
  examples: BilingualExample[];
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

export default function WordDetails({ wordId, word, family, records, aiData: originalAiData, aiMeta, aiGlosses: originalGlosses, examples: originalExamples, personalNote, onNoteChange }: Props) {
  const aiData = editedEnrichment(wordId, originalAiData);
  const examples = editedExamples(wordId) ?? originalExamples;
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
          <h4>例句與造句提示</h4>
          <VerifiedItems records={verifiedFor(records, ["example"])} />
          {examples.length ? <div className="ai-example-list">{examples.map((example) => (
            <p key={example.englishSentenceId ? `${example.englishSentenceId}-${example.chineseSentenceId}` : `ai-${wordId}-${example.en}`}>
              <span className="example-english"><HighlightedText text={example.en} start={example.enStart} end={example.enEnd} /></span>
              <small className="example-translation"><HighlightedText text={example.zh} start={example.zhStart} end={example.zhEnd} /></small>
            </p>
          ))}</div> : <p className="detail-empty">目前沒有通過完整雙語與目標詞對應檢查的例句。</p>}
          {aiData?.definitions.length ? <p className="definition-note">詞典英文釋義：{aiData.definitions.join("；")}</p> : null}
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
        <aside className="ai-content-notice">
          <strong>AI 延伸內容說明</strong>
          <p>{aiMeta?.notice ?? "延伸內容由 AI 與程式自動整理，未經人工逐筆核對，可能有錯漏，請以正式字典與教師說明為準。"}</p>
          {aiMeta && <small>主要資料來源：<a href={aiMeta.source.url} target="_blank" rel="noreferrer">{aiMeta.source.title}</a> · <a href={aiMeta.source.licenseUrl} target="_blank" rel="noreferrer">{aiMeta.source.license}</a></small>}
        </aside>
      </div>
    </details>
  );
}
