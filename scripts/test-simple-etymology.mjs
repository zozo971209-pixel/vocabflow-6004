import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { simpleBreakdownFor } from "../app/etymology.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(fs.readFileSync(path.join(root, "public", "etymology.json"), "utf8"));
const records = Object.values(payload.records ?? {});

assert.equal(records.length, 6004, "必須檢查完整 6,004 詞");

for (const record of records) {
  const breakdown = simpleBreakdownFor(record);
  assert.ok(breakdown.trim(), `${record.wordId} ${record.headword}: 簡析不可空白`);
  assert.ok(breakdown.length <= 60, `${record.wordId} ${record.headword}: 簡析過長`);
  if (breakdown.includes("＋")) {
    for (const component of breakdown.split("＋")) {
      assert.match(component, /^.+（[^（）]+）$/, `${record.wordId} ${record.headword}: 每個拆解部分都必須附解釋：${breakdown}`);
    }
  }
}

const spot = payload.records["5063"];
const preserve = payload.records["4103"];
const spiritual = payload.records["5046"];

assert.equal(spot.headword, "spot");
assert.equal(simpleBreakdownFor(spot), "spot（不宜拆分）");
assert.equal(simpleBreakdownFor(preserve), "prae（在前）＋servare（保護）");
assert.equal(simpleBreakdownFor(spiritual), "spiritus（氣息、精神）＋-alis（形容詞字尾）");
assert.ok(!simpleBreakdownFor(payload.records["1389"]).includes("＋"), "debate 不可採用否定句中的 de-『刪去』");
assert.ok(!simpleBreakdownFor(payload.records["267"]).includes("＋"), "approval 不可把名詞 -al 誤標為形容詞字尾");

const decomposedCount = records.filter((record) => simpleBreakdownFor(record).includes("＋")).length;
console.log(`Simple etymology test passed: ${records.length} records, ${decomposedCount} fully explained decompositions.`);
