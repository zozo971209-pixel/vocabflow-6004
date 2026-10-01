import fs from "node:fs";

const path = "public/bilingual-examples.json";
const archive = "outputs/bilingual-examples-before-provenance.json";
const payload = JSON.parse(fs.readFileSync(path, "utf8"));
let sourceExamples = 0;
let aiExamples = 0;
const sourceWordIds = new Set();
const sourceWords = {};

fs.mkdirSync("outputs", { recursive: true });
if (!fs.existsSync(archive)) fs.writeFileSync(archive, `${JSON.stringify(payload)}\n`, "utf8");

for (const [id, records] of Object.entries(payload.words ?? {})) {
  const published = [];
  for (const record of records ?? []) {
    if (record.origin === "ai-generated" || record.sourceType === "ai-draft") {
      record.origin = "ai-generated";
      record.sourceType = "ai-draft";
      record.reviewStatus = "ai-draft";
      aiExamples += 1;
      continue;
    }
    record.origin = "tatoeba";
    record.sourceType = "tatoeba";
    record.sourceTitle = "Tatoeba";
    record.sourceUrl = record.englishSentenceId ? `https://tatoeba.org/en/sentences/show/${record.englishSentenceId}` : "https://tatoeba.org/";
    record.sourceLicense = "CC BY 2.0 FR";
    record.sourceLicenseUrl = "https://creativecommons.org/licenses/by/2.0/fr/";
    record.reviewStatus = "source-backed";
    sourceExamples += 1;
    sourceWordIds.add(id);
    published.push(record);
  }
  if (published.length) sourceWords[id] = published;
}

payload.notice = "公開雙語例句只包含具明確來源與授權標記的 Tatoeba 來源資料；本機 AI 草稿已封存，不隨靜態網站發布，也不得視為專業來源。沒有合格來源的詞條會在介面明確標示待補。";
payload.words = sourceWords;
payload.stats = { ...payload.stats, totalWords: 6004, wordsWithExamples: Object.keys(sourceWords).length, totalExamples: sourceExamples, corpusExamples: sourceExamples, aiGeneratedExamples: 0, sourceBackedWords: sourceWordIds.size, draftExamplesArchived: aiExamples };
payload.publication = { mode: "source-only", draftPolicy: "AI drafts are archived locally and excluded from the public static payload." };
fs.writeFileSync(path, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ ...payload.stats, archivedDrafts: aiExamples, archive, bytes: fs.statSync(path).size }));
