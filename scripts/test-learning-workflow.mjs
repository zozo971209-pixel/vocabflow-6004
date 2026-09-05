import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
async function load(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { scheduleReview, dueReviewIds } = await load("app/reviewSchedule.ts");
const { parseProgressBackup, mergeProgress } = await load("app/progressBackup.ts");
const { persistProgress } = await load("app/progressStorage.ts");
const { isChineseMeaningCorrect, isFillAnswerCorrect, fillAnswerFeedback } = await load("app/quizAnswers.ts");
const now = new Date(2026, 0, 31, 12);
const first = scheduleReview(undefined, true, now);
assert.equal(first.due, "2026-02-01");
assert.deepEqual(scheduleReview(first, true, now), first);
const second = scheduleReview(first, true, new Date(2026, 1, 1, 12));
assert.equal(second.due, "2026-02-04");
const failed = scheduleReview(second, false, now);
assert.equal(failed.streak, 0);
assert.equal(failed.due, "2026-02-01");
assert.equal(failed.mistakes, 1);
assert.deepEqual(dueReviewIds({ 1: first, 2: second, 3: failed }, "2026-02-01"), [3, 1]);
assert(isChineseMeaningCorrect("可能", "a. 可能的, 潛在的"));
assert(!isChineseMeaningCorrect("可能", "n. 可能性"));
assert(!isChineseMeaningCorrect("有責任", "a. 有責任感的"));
assert(!isChineseMeaningCorrect("不可能", "a. 可能的"));
assert(isChineseMeaningCorrect("是", "v. 是, 存在"));
assert(isFillAnswerCorrect("Apple!", "apple"));
assert(isFillAnswerCorrect("colour", "color/colour"));
assert(!isFillAnswerCorrect("apples", "apple"));
assert(fillAnswerFeedback("apples", "apple", "zh-to-en").includes("詞形"));
const current = { statuses: { 1: "known" }, notes: { 1: "本機筆記" }, reviews: { 1: first }, quizHistory: [], settings: { currentDay: 1, startDate: "2026-01-31", speechSpeed: "normal", speechSpeedVersion: 3, theme: "dark", fontSize: "large" } };
const incoming = { ...current, statuses: { 1: "unknown", 2: "review" }, notes: { 1: "匯入筆記", 2: "新增筆記" } };
const envelope = progress => ({ format: "vocabflow-progress", version: 1, progress });
const ids = new Set([1, 2, 3]);
assert.deepEqual(parseProgressBackup(envelope(current), ids, 121).progress, current);
const merged = mergeProgress(current, incoming);
assert.equal(merged.statuses[1], "known");
assert.equal(merged.statuses[2], "review");
assert.equal(merged.notes[1], "本機筆記");
assert.equal(merged.notes[2], "新增筆記");
assert.equal(merged.settings.theme, "dark");
assert.throws(() => parseProgressBackup(envelope({ ...current, settings: { ...current.settings, startDate: "2026-02-31" } }), ids, 121));
assert.throws(() => parseProgressBackup(envelope({ ...current, notes: { 1: 7 } }), ids, 121));
assert.throws(() => parseProgressBackup(envelope({ ...current, quizHistory: [{ id: "bad", total: -1 }] }), ids, 121));
assert.throws(() => parseProgressBackup(envelope({ ...current, reviews: { 1: { ...first, streak: -1 } } }), ids, 121));
const legacy = { ...current }; delete legacy.notes; delete legacy.quizHistory; delete legacy.reviews;
assert.deepEqual(parseProgressBackup(envelope(legacy), ids, 121).progress.notes, {});
assert.deepEqual(parseProgressBackup(envelope(legacy), ids, 121).progress.reviews, {});
const saved = new Map();
let failOnce = false;
const fakeStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => {
    if (failOnce && key === "vocab6004-settings-v1") { failOnce = false; throw new Error("quota"); }
    saved.set(key, value);
  },
  removeItem: key => saved.delete(key),
};
persistProgress(fakeStorage, current);
const beforeFailure = [...saved];
failOnce = true;
assert.throws(() => persistProgress(fakeStorage, { ...incoming, settings: { ...incoming.settings, currentDay: 2 } }));
assert.deepEqual([...saved], beforeFailure, "A partial write must restore every previous value");
persistProgress(fakeStorage, incoming);
assert.equal(JSON.parse(saved.get("vocab6004-progress-v1"))[2], "review");
console.log("PASS: review dates, wrong-answer reset, tolerant precise grading, backup validation, merge conflicts and legacy imports");
