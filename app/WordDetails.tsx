"use client";

import { irregularFormFor } from "./wordEnhancements";
import { EnrichmentCategory, VerifiedEnrichmentRecord } from "./enrichment";
import { AiEnrichmentPayload, AiEnrichmentWord } from "./aiEnrichment";

type Props = {
  wordId: number;
  word: string;
  family: string[];
  records: VerifiedEnrichmentRecord[];
  aiData?: AiEnrichmentWord;
  aiMeta: Pick<AiEnrichmentPayload, "notice" | "source"> | null;
  personalNote: string;
  onNoteChange: (wordId: number, note: string) => void;
};

function VerifiedItems({ records }: { records: VerifiedEnrichmentRecord[] }) {
  if (!records.length) return null;
  return <div className="verified-list">{records.map((record) => (
    <article className="verified-item" key={record.recordId}>
      <div className="verified-heading"><span className="verified-badge">✓ 人工核對</span>{record.senseZh && <small>{record.senseZh}</small>}</div>
      {record.category === "example"
        ? <p><strong>{record.exampleEn}</strong><br />{record.exampleZh}</p>
        : <p><strong>{record.contentEn}</strong>{record.contentZh && <> — {record.contentZh}</>}</p>}
      <p className="verified-source">
        來源：<a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceTitle}</a>
        {record.sourceLocation && ` · ${record.sourceLocation}`} · {record.sourceLicense}<br />
        核對：{record.reviewer} · {record.verifiedAt}
      </p>
    </article>
  ))}</div>;
}

function AiList({ items, emptyText }: { items?: string[]; emptyText: string }) {
  if (!items?.length) return <p className="detail-empty">{emptyText}</p>;
  return <ul className="ai-detail-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function verifiedFor(records: VerifiedEnrichmentRecord[], categories: EnrichmentCategory[]) {
  return records.filter((record) => categories.includes(record.category));
}

export default function WordDetails({ wordId, word, family, records, aiData, aiMeta, personalNote, onNoteChange }: Props) {
  const irregular = irregularFormFor(word);
  const verifiedFamily = records.filter((record) => record.category === "word_family");
  const verifiedIrregular = records.filter((record) => record.category === "irregular_form");
  const combinedFamily = [...new Set([...(aiData?.family ?? []), ...family])].filter((item) => item.toLowerCase() !== word.toLowerCase());
  const combinedForms = [...new Set([...(irregular ? [irregular] : []), ...(aiData?.forms ?? [])])];

  return (
    <details className="word-details">
      <summary><span>延伸學習與筆記</span><small>點擊展開</small></summary>
      <div className="word-details-content">
        <section>
          <h4>詞族整理</h4>
          <VerifiedItems records={verifiedFamily} />
          <AiList items={combinedFamily} emptyText="目前沒有找到可直接對應的詞族。" />
        </section>
        <section>
          <h4>詞形與不規則變化</h4>
          <VerifiedItems records={verifiedIrregular} />
          <AiList items={combinedForms} emptyText="未收錄特殊詞形，或此詞不適用。" />
        </section>
        <section>
          <h4>搭配詞與句型練習</h4>
          <VerifiedItems records={verifiedFor(records, ["collocation"])} />
          <AiList items={aiData?.collocations} emptyText="目前沒有可用的搭配資料。" />
        </section>
        <section>
          <h4>片語與固定用法</h4>
          <VerifiedItems records={verifiedFor(records, ["fixed_phrase"])} />
          <AiList items={aiData?.phrases} emptyText="詞典未列出固定片語；不代表此詞沒有其他語境搭配。" />
        </section>
        <section>
          <h4>例句與造句提示</h4>
          <VerifiedItems records={verifiedFor(records, ["example"])} />
          {aiData?.examples.length ? <div className="ai-example-list">{aiData.examples.map((example) => (
            <p key={example.en}><strong>{example.en}</strong><small>中文理解提示：{example.zhHint}</small></p>
          ))}</div> : <p className="detail-empty">請使用上方「{aiData?.collocations[0] ?? word}」完成一個句子，並對照主要中文詞義。</p>}
          {aiData?.definitions.length ? <p className="definition-note">詞典英文釋義：{aiData.definitions.join("；")}</p> : null}
        </section>
        <section>
          <h4>同義詞與反義詞</h4>
          <VerifiedItems records={verifiedFor(records, ["synonym", "antonym"])} />
          <p className="detail-label">同義詞</p>
          <AiList items={aiData?.synonyms} emptyText="詞典未列出可直接替換的同義詞。" />
          <p className="detail-label">反義詞</p>
          <AiList items={aiData?.antonyms} emptyText="詞典未列出直接反義詞。" />
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
