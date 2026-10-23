import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vocab = JSON.parse(fs.readFileSync(path.join(root, "public", "vocab.json"), "utf8"));
const payload = JSON.parse(fs.readFileSync(path.join(root, "public", "etymology.json"), "utf8"));
const errors = [];

if (!Array.isArray(vocab) || vocab.length !== 6004) errors.push(`vocab count: ${Array.isArray(vocab) ? vocab.length : "invalid"}`);
if (payload.schemaVersion !== 1) errors.push(`schemaVersion: ${payload.schemaVersion}`);
if (payload.recordCount !== 6004) errors.push(`recordCount: ${payload.recordCount}`);

const entries = Object.entries(payload.records ?? {});
if (entries.length !== 6004) errors.push(`record keys: ${entries.length}`);
const vocabById = new Map((Array.isArray(vocab) ? vocab : []).map((word) => [word.id, word]));
if (vocabById.size !== 6004) errors.push(`unique vocab ids: ${vocabById.size}`);

const requiredText = ["headword", "etymon", "modernSegmentation", "historicalComponents", "languageRoute", "developmentZh", "learningNoteZh", "caveatZh"];
for (let wordId = 1; wordId <= 6004; wordId += 1) {
  const word = vocabById.get(wordId);
  const record = payload.records?.[String(wordId)];
  if (!word || word.id !== wordId) {
    errors.push(`official sequence mismatch: ${wordId}`);
    continue;
  }
  if (!record) {
    errors.push(`missing etymology: ${wordId}`);
    continue;
  }
  if (record.wordId !== wordId || record.headword !== word.word) errors.push(`identity mismatch: ${wordId}`);
  for (const field of requiredText) if (typeof record[field] !== "string" || !record[field].trim()) errors.push(`empty ${field}: ${wordId}`);
  if (!Array.isArray(record.relatedForms)) errors.push(`invalid relatedForms: ${wordId}`);
  if (!Array.isArray(record.sources) || record.sources.length < 1) errors.push(`missing sources: ${wordId}`);
  for (const source of record.sources ?? []) if (typeof source.url !== "string" || !/^https:\/\//.test(source.url)) errors.push(`invalid source URL: ${wordId}`);
  if (typeof record.hasUncertainty !== "boolean") errors.push(`invalid uncertainty flag: ${wordId}`);
}

if (vocabById.get(6004)?.word !== "zoom" || payload.records?.["6004"]?.headword !== "zoom") errors.push("final word is not 6004 zoom");

if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  console.error(`Etymology audit failed with ${errors.length} issue(s).`);
  process.exit(1);
}

const uncertaintyCount = entries.filter(([, record]) => record.hasUncertainty).length;
const singleSourceCount = entries.filter(([, record]) => record.sources.length === 1).length;
console.log(`Etymology audit passed: ${entries.length} records, ${uncertaintyCount} uncertainty-labelled, ${singleSourceCount} single-source.`);
