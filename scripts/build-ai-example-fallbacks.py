"""Fill words without a corpus example by using a local Ollama model.

The script is resumable. Intermediate accepted records are saved under outputs,
then merged into public/bilingual-examples.json after every successful batch.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path

from opencc import OpenCC


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "public" / "vocab.json"
ENRICHMENT_PATH = ROOT / "public" / "enrichment-ai.json"
EXAMPLE_PATH = ROOT / "public" / "bilingual-examples.json"
CACHE_PATH = ROOT / "outputs" / "ai-example-cache.json"
TOKEN_RE = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")
HAN_RE = re.compile(r"[\u3400-\u9fff]")
TERMINAL_EN_RE = re.compile(r"[.!?]$")
TERMINAL_ZH_RE = re.compile(r"[。！？]$")
TAIWAN_REPLACEMENTS = {
    "計劃": "計畫", "視頻": "影片", "軟件": "軟體", "硬件": "硬體", "文件夾": "資料夾",
    "鼠標": "滑鼠", "打印機": "印表機", "互聯網": "網際網路", "出租汽車": "計程車",
    "澳大利亞": "澳洲", "鐳射": "雷射", "質量": "品質", "互相互動": "互動",
}
MANUAL_FALLBACKS = {
    1946: {"en": "His exclusion from the team surprised everyone.", "zh": "他被排除在隊伍之外，讓大家都很驚訝。", "targetEn": "exclusion", "targetZh": "排除", "pos": "n"},
    4105: {"en": "She won the presidency after a close election.", "zh": "她在激烈選舉後贏得總統職位。", "targetEn": "presidency", "targetZh": "總統職位", "pos": "n"},
    2441: {"en": "He felt deep guilt after telling the lie.", "zh": "他說謊後感到深深的內疚。", "targetEn": "guilt", "targetZh": "內疚", "pos": "n"},
    388: {"en": "Please sit here and rest awhile.", "zh": "請坐在這裡休息片刻。", "targetEn": "awhile", "targetZh": "片刻", "pos": "adv"},
    22: {"en": "This painting is a colorful abstraction.", "zh": "這幅畫是一件色彩繽紛的抽象派作品。", "targetEn": "abstraction", "targetZh": "抽象派作品", "pos": "n"},
    3604: {"en": "The meeting starts at nine o’clock.", "zh": "會議在九點鐘開始。", "targetEn": "o’clock", "targetZh": "點鐘", "pos": "adv"},
    4595: {"en": "The author earns royalties from each book.", "zh": "作者從每本書獲得使用費。", "targetEn": "royalties", "targetZh": "使用費", "pos": "n"},
    1810: {"en": "Poverty led to widespread emigration.", "zh": "貧窮導致大規模移民。", "targetEn": "emigration", "targetZh": "移民", "pos": "n"},
    3875: {"en": "Ninety percent of the students passed.", "zh": "百分之九十的學生通過了。", "targetEn": "percent", "targetZh": "百分之", "pos": "n"},
    2717: {"en": "Everyone joined the trip, including our teacher.", "zh": "每個人都參加了旅行，包括我們的老師。", "targetEn": "including", "targetZh": "包括", "pos": "prep"},
    239: {"en": "The plan failed, but we tried anyhow.", "zh": "計畫失敗了，但我們無論如何都嘗試過。", "targetEn": "anyhow", "targetZh": "無論如何", "pos": "adv"},
    5369: {"en": "She joined the team during her teenage years.", "zh": "她在青少年時期加入了球隊。", "targetEn": "teenage", "targetZh": "青少年", "pos": "adj"},
    5880: {"en": "There is no doubt whatsoever.", "zh": "完全沒有任何疑問。", "targetEn": "whatsoever", "targetZh": "任何", "pos": "pron"},
    4859: {"en": "The two events had simultaneous starts.", "zh": "兩場活動同時開始。", "targetEn": "simultaneous", "targetZh": "同時", "pos": "adj"},
    582: {"en": "We bought snacks from a nearby booth.", "zh": "我們從附近的攤位買了點心。", "targetEn": "booth", "targetZh": "攤位", "pos": "n"},
    4886: {"en": "The rescued dog was extremely skinny.", "zh": "那隻獲救的狗非常瘦弱。", "targetEn": "skinny", "targetZh": "瘦弱", "pos": "adj"},
    4071: {"en": "She said a prayer before dinner.", "zh": "她在晚餐前做了祈禱。", "targetEn": "prayer", "targetZh": "祈禱", "pos": "n"},
    2202: {"en": "Details will appear in the forthcoming report.", "zh": "詳細資訊將出現在即將發布的報告中。", "targetEn": "forthcoming", "targetZh": "即將", "pos": "adj"},
}


def target_word(raw: str) -> str:
    value = re.sub(r"\([^)]*\)", "", raw).replace(".", "").strip()
    parts = [part.strip() for part in value.split("/") if part.strip()]
    return parts[0] if parts else value


def compact_meaning(raw: str) -> str:
    lines = [line for line in raw.replace("\\n", "\n").splitlines() if not line.lstrip().startswith("[")]
    return "；".join(lines)[:180]


def request_examples(items: list[dict[str, object]], model: str) -> list[dict[str, object]]:
    prompt = (
        "你是臺灣高中英文教材編輯。為每個項目寫一個最自然、最常用、可獨立理解的短例句與完整臺灣繁體中文翻譯。"
        "英文必須包含 target 或其正確單複數、時態變化一次，5到10個英文詞；targetEn填句中實際出現的完整詞形。中文必須包含能直接對應 target 的 targetZh，譯文簡潔自然。"
        "優先採用該詞最常見的詞性與主要字義，不用人名、冷僻典故、爭議內容或中國大陸用語。"
        "targetZh只填譯文中實際出現的對應詞，不加解釋。每個輸入必須輸出一筆，id完全相同。\n輸入："
        + json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    )
    schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"}, "en": {"type": "string"}, "zh": {"type": "string"},
                        "targetEn": {"type": "string"}, "targetZh": {"type": "string"}, "pos": {"type": "string"},
                    },
                    "required": ["id", "en", "zh", "targetEn", "targetZh", "pos"],
                },
            }
        },
        "required": ["items"],
    }
    body = json.dumps({
        "model": model, "prompt": prompt, "stream": False, "think": False, "format": schema,
        "options": {"temperature": 0.15, "top_p": 0.85, "num_predict": max(700, len(items) * 90)},
    }).encode("utf-8")
    request = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=600) as response:
        payload = json.loads(response.read().decode("utf-8"))
    try:
        parsed = json.loads(payload["response"])
    except json.JSONDecodeError:
        return []
    return parsed.get("items", []) if isinstance(parsed, dict) else []


def normalize_zh(text: str, converter: OpenCC) -> str:
    text = converter.convert(text.strip())
    for source, target in TAIWAN_REPLACEMENTS.items():
        text = text.replace(source, target)
    text = re.sub(r",(?=\S)", "，", text)
    text = re.sub(r"\.$", "。", text)
    text = re.sub(r"\?$", "？", text)
    return re.sub(r"!$", "！", text)


def valid_inflection(base: str, surface: str) -> bool:
    base, surface = base.lower(), surface.lower()
    forms = {base, base + "s", base + "es", base + "ed", base + "ing"}
    if base.endswith("y") and len(base) > 1:
        forms.update({base[:-1] + "ies", base[:-1] + "ied"})
    if base.endswith("e"):
        forms.update({base[:-1] + "ing", base + "d"})
    if len(base) > 2 and base[-1] not in "aeiouwxy" and base[-2] in "aeiou":
        forms.update({base + base[-1] + "ed", base + base[-1] + "ing"})
    return surface in forms


def validate(raw: dict[str, object], expected: dict[str, object], converter: OpenCC) -> dict[str, object] | None:
    try:
        if int(raw.get("id", -1)) != int(expected["id"]):
            return None
        en = str(raw.get("en", "")).strip()
        zh = normalize_zh(str(raw.get("zh", "")), converter)
        target = str(expected["target"])
        allowed_forms = [target, *(str(value) for value in expected.get("forms", []))]
        target_en = str(raw.get("targetEn", target)).strip()
        raw_matches = list(re.finditer(rf"(?<![A-Za-z]){re.escape(target_en)}(?![A-Za-z])", en, re.I)) if target_en else []
        if len(raw_matches) != 1 or not any(valid_inflection(form, target_en) for form in allowed_forms):
            target_en = next((token for token in TOKEN_RE.findall(en) if any(valid_inflection(form, token) for form in allowed_forms)), "")
        matches = list(re.finditer(rf"(?<![A-Za-z]){re.escape(target_en)}(?![A-Za-z])", en, re.I)) if target_en else []
        if len(matches) != 1 or not 4 <= len(TOKEN_RE.findall(en)) <= 16:
            return None
        target_source = normalize_zh(str(raw.get("targetZh", "")), converter).rstrip("。！？")
        meaning_source = normalize_zh(str(expected.get("meaning", "")), converter).rstrip("。！？")
        candidates = []
        for value in re.split(r"[，,、；;/]", target_source + "；" + meaning_source):
            value = re.sub(r"^(?:vt|vi|v|n|a|adj|adv|prep|pron|conj|art|aux)\.\s*", "", value.strip(), flags=re.I)
            value = re.sub(r"\([^)]*\)|\.\.\.", "", value).strip()
            if value and HAN_RE.search(value) and value in zh:
                candidates.append(value)
        target_zh = max(candidates, key=len, default="")
        if not target_zh or not HAN_RE.search(target_zh) or target_zh not in zh:
            return None
        if not TERMINAL_EN_RE.search(en) or not TERMINAL_ZH_RE.search(zh):
            return None
        en_match = matches[0]
        zh_start = zh.find(target_zh)
        return {
            "en": en, "zh": zh, "enStart": en_match.start(), "enEnd": en_match.end(),
            "zhStart": zh_start, "zhEnd": zh_start + len(target_zh),
            "targetEn": en[en_match.start():en_match.end()], "targetZh": target_zh,
            "senseZh": target_zh, "pos": str(raw.get("pos", "")).strip().lower().rstrip("."),
            "qualityScore": 80, "origin": "ai-generated",
        }
    except (KeyError, TypeError, ValueError):
        return None


def save(cache: dict[str, dict[str, object]], examples: dict[str, object]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for word_id, record in cache.items():
        examples["words"].setdefault(word_id, [record])
    examples["schemaVersion"] = 2
    examples["notice"] = "例句優先取自 Tatoeba；缺少可靠句對的詞條由本機 AI 依主要詞義造句。全部例句均通過完整性、臺灣繁中、目標詞位置、長度與格式自動檢查，未經人工逐句核對。"
    all_records = [record for records in examples["words"].values() for record in records]
    examples["stats"] = {
        "totalWords": 6004, "wordsWithExamples": len(examples["words"]), "totalExamples": len(all_records),
        "corpusExamples": sum(record.get("origin", "tatoeba") != "ai-generated" for record in all_records),
        "aiGeneratedExamples": sum(record.get("origin") == "ai-generated" for record in all_records),
    }
    EXAMPLE_PATH.write_text(json.dumps(examples, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen3:4b")
    parser.add_argument("--batch-size", type=int, default=12)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--diagnose", action="store_true")
    args = parser.parse_args()

    converter = OpenCC("s2twp")
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    enrichment = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))
    examples = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
    vocab_by_id = {int(item["id"]): item for item in vocab}
    for word_id, raw in MANUAL_FALLBACKS.items():
        if str(word_id) in examples["words"] or str(word_id) in cache:
            continue
        item = vocab_by_id[word_id]
        expected = {"id": word_id, "target": target_word(str(item["word"])), "forms": enrichment.get("words", {}).get(str(word_id), {}).get("forms", []), "meaning": compact_meaning(str(item["meaning"]))}
        record = validate({"id": word_id, **raw}, expected, converter)
        if record:
            cache[str(word_id)] = record
    save(cache, examples)
    missing = [item for item in vocab if str(item["id"]) not in examples["words"] and str(item["id"]) not in cache]
    if args.limit:
        missing = missing[:args.limit]

    if args.diagnose:
        batch_items = missing[:args.batch_size]
        pending = [{"id": int(item["id"]), "target": target_word(str(item["word"])), "forms": enrichment.get("words", {}).get(str(item["id"]), {}).get("forms", []), "pos": str(item["pos"]), "level": int(item["level"]), "meaning": compact_meaning(str(item["meaning"]))} for item in batch_items]
        results = request_examples(pending, args.model)
        by_id = {int(item.get("id", -1)): item for item in results if isinstance(item, dict)}
        report = [{"expected": item, "raw": by_id.get(int(item["id"])), "accepted": bool(validate(by_id.get(int(item["id"]), {}), item, converter))} for item in pending]
        print(json.dumps(report, ensure_ascii=True))
        return

    accepted = 0
    for offset in range(0, len(missing), args.batch_size):
        batch_items = missing[offset:offset + args.batch_size]
        pending = [{"id": int(item["id"]), "target": target_word(str(item["word"])), "forms": enrichment.get("words", {}).get(str(item["id"]), {}).get("forms", []), "pos": str(item["pos"]), "level": int(item["level"]), "meaning": compact_meaning(str(item["meaning"]))} for item in batch_items]
        expected = {int(item["id"]): item for item in pending}
        attempts = 0
        while pending and attempts < 2:
            attempts += 1
            results = request_examples(pending, args.model)
            next_pending = []
            returned = {int(result.get("id", -1)): result for result in results if isinstance(result, dict)}
            for item in pending:
                record = validate(returned.get(int(item["id"]), {}), expected[int(item["id"])], converter)
                if record:
                    cache[str(item["id"])] = record
                    accepted += 1
                else:
                    next_pending.append(item)
            pending = next_pending
        save(cache, examples)
        done = min(offset + len(batch_items), len(missing))
        print(json.dumps({"processed": done, "requested": len(missing), "acceptedThisRun": accepted, "retryRemaining": len(pending)}, ensure_ascii=False), flush=True)
    if not missing:
        save(cache, examples)


if __name__ == "__main__":
    main()
