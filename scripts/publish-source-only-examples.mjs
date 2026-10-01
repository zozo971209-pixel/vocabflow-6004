import fs from "node:fs";

const publicPath = "public/bilingual-examples.json";
const archivePath = "outputs/bilingual-examples-with-ai-drafts.json";
const payload = JSON.parse(fs.readFileSync(publicPath, "utf8"));

fs.mkdirSync("outputs", { recursive: true });
if (!fs.existsSync(archivePath)) {
  fs.writeFileSync(archivePath, `${JSON.stringify(payload)}\n`, "utf8");
}

const sourceTypes = new Set(["tatoeba", "open-wordnet"]);
const publishedWords = {};
let sourceExamples = 0;
let archivedDraftExamples = 0;
const sourceWordIds = new Set();

for (const [id, records] of Object.entries(payload.words ?? {})) {
  const sourceRecords = (records ?? []).filter((record) => {
    const isSource = sourceTypes.has(record.sourceType);
    if (!isSource) archivedDraftExamples += 1;
    return isSource;
  });
  if (sourceRecords.length) {
    publishedWords[id] = sourceRecords;
    sourceExamples += sourceRecords.length;
    sourceWordIds.add(id);
  }
}

payload.notice = "公開雙語例句只包含具明確來源與授權標記的 Tatoeba／Open English Wordnet 用例；本機 AI 草稿已封存於 outputs/，不隨靜態網站發布，也不得視為專業來源。沒有合格來源的詞條會在介面明確標示待補。";
payload.words = publishedWords;
payload.stats = {
  totalWords: 6004,
  wordsWithExamples: Object.keys(publishedWords).length,
  totalExamples: sourceExamples,
  corpusExamples: sourceExamples,
  aiGeneratedExamples: 0,
  sourceBackedWords: sourceWordIds.size,
  draftExamplesArchived: archivedDraftExamples,
};
payload.publication = {
  mode: "source-only",
  publishedAt: new Date().toISOString(),
  draftPolicy: "AI drafts are archived locally and excluded from the public static payload.",
};

fs.writeFileSync(publicPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({
  ...payload.stats,
  archivePath,
  bytes: fs.statSync(publicPath).size,
}, null, 2));
