"""Add Traditional Chinese glosses for word-family, collocation and synonym items.

Single words and dictionary phrases prefer ECDICT. Remaining phrases are
translated with a local Ollama model. Progress is resumable and saved after
every batch.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
import urllib.request
from pathlib import Path

from opencc import OpenCC


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "public" / "vocab.json"
ENRICHMENT_PATH = ROOT / "public" / "enrichment-ai.json"
CACHE_PATH = ROOT / "outputs" / "enrichment-gloss-cache.json"
HAN_RE = re.compile(r"[\u3400-\u9fff]")
POS_LABELS = {
    "n.": "名詞：", "v.": "動詞：", "vt.": "及物動詞：", "vi.": "不及物動詞：",
    "a.": "形容詞：", "adj.": "形容詞：", "adv.": "副詞：", "prep.": "介系詞：",
    "pron.": "代名詞：", "conj.": "連接詞：", "num.": "數詞：", "art.": "冠詞：",
}
TAIWAN_REPLACEMENTS = {
    "網絡": "網路", "視頻": "影片", "軟件": "軟體", "硬件": "硬體", "文件夾": "資料夾",
    "鼠標": "滑鼠", "打印機": "印表機", "出租汽車": "計程車", "質量": "品質",
}


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value).replace("_", " ").strip().lower())


def to_tw(text: str, converter: OpenCC) -> str:
    result = converter.convert(text.strip())
    for source, target in TAIWAN_REPLACEMENTS.items():
        result = result.replace(source, target)
    return result


def compact_translation(raw: str, converter: OpenCC) -> str:
    lines = [line.strip() for line in raw.replace("\\n", "\n").splitlines() if line.strip()]
    preferred = [line for line in lines if not line.startswith("[")]
    selected = (preferred or lines)[:2]
    parts = []
    for line in selected:
        line = re.sub(r"^\[[^]]+\]\s*", "", line)
        for prefix, label in POS_LABELS.items():
            if line.lower().startswith(prefix):
                line = label + line[len(prefix):].strip()
                break
        line = re.sub(r"[;,]\s*", "、", line)
        if line:
            parts.append(line)
    return to_tw("；".join(parts), converter)[:100].rstrip("、；")


def primary_meaning(raw: str, converter: OpenCC) -> str:
    return compact_translation(raw, converter).split("；")[0][:60]


def request_glosses(items: list[dict[str, object]], model: str) -> list[dict[str, object]]:
    prompt = (
        "你是臺灣高中英文教材編輯。把每個 en 翻成簡潔、自然、可獨立理解的臺灣繁體中文。"
        "這些內容是搭配詞、短句或相關詞；請依 target 與 targetMeaning 選擇正確語意。"
        "只翻譯原文，不加詞性、英文、補充說明或句號。人名保留常見音譯。"
        "每個輸入必須輸出一筆，i 必須原樣保留。只輸出 i 與 z。\n輸入："
        + json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    )
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {"i": {"type": "integer"}, "z": {"type": "string"}},
            "required": ["i", "z"],
        },
    }
    body = json.dumps({
        "model": model, "prompt": prompt, "stream": False, "think": False, "format": schema,
        "options": {"temperature": 0.1, "top_p": 0.8, "num_predict": max(500, len(items) * 28)},
    }).encode("utf-8")
    request = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=600) as response:
        payload = json.loads(response.read().decode("utf-8"))
    try:
        parsed = json.loads(payload["response"])
    except (KeyError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def save(payload: dict[str, object], glosses: dict[str, str], cache: dict[str, str]) -> None:
    payload["schemaVersion"] = 2
    payload["glosses"] = dict(sorted(glosses.items()))
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    temporary = ENRICHMENT_PATH.with_suffix(".json.tmp")
    for attempt in range(6):
        try:
            temporary.write_text(serialized, encoding="utf-8")
            os.replace(temporary, ENRICHMENT_PATH)
            break
        except OSError:
            if attempt == 5:
                raise
            time.sleep(0.25 * (attempt + 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ecdict_csv", type=Path)
    parser.add_argument("--model", default="qwen3:4b")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    converter = OpenCC("s2twp")
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    payload = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
    glosses: dict[str, str] = {}
    # The official combined entry "am/a.m." mixes the verb form and time abbreviation;
    # avoid the mechanically generated and ungrammatical "to am/a.m." practice phrase.
    if "188" in payload["words"]:
        payload["words"]["188"]["collocations"] = ["I am ready"]
        glosses["i am ready"] = "我準備好了"
    if "3996" in payload["words"]:
        payload["words"]["3996"]["collocations"] = ["at 3 p.m."]
        glosses["at 3 p.m."] = "在下午三點"
    glosses["r-2"] = "氟硝西泮的街頭俗稱"
    glosses["funds essential to the"] = "對……至關重要的資金"
    glosses["till the soil"] = "耕作土壤"
    glosses["the wrestler's charge carried him"] = "摔角選手向前猛衝"
    glosses["violinist didn't manage her bow"] = "小提琴手沒能控制好琴弓"
    glosses["and sue pan the movie"] = "而蘇批評了這部電影"
    glosses["competitors went under"] = "競爭者破產了"

    contexts: dict[str, dict[str, str]] = {}
    for item in vocab:
        word_id = str(item["id"])
        target = re.sub(r"\([^)]*\)", "", str(item["word"])).split("/")[0].strip()
        meaning = primary_meaning(str(item["meaning"]), converter)
        for value in [*payload["words"].get(word_id, {}).get("family", []), *payload["words"].get(word_id, {}).get("collocations", []), *payload["words"].get(word_id, {}).get("synonyms", [])]:
            contexts.setdefault(normalize(value), {"en": str(value), "target": target, "targetMeaning": meaning})
        for form in re.sub(r"\([^)]*\)", "", str(item["word"])).split("/"):
            if form.strip():
                glosses.setdefault(normalize(form), meaning)

    needed = set(contexts)
    with args.ecdict_csv.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = normalize(row.get("word", ""))
            if key in needed and key not in glosses and (row.get("translation") or "").strip():
                value = compact_translation(row["translation"], converter)
                if value and HAN_RE.search(value):
                    glosses[key] = value

    for key, value in cache.items():
        glosses.setdefault(normalize(key), to_tw(str(value), converter))
    missing = [key for key in contexts if key not in glosses]
    if args.limit:
        missing = missing[:args.limit]

    accepted = 0
    for offset in range(0, len(missing), args.batch_size):
        keys = missing[offset:offset + args.batch_size]
        items = [{"i": index, "en": contexts[key]["en"], "t": contexts[key]["target"], "m": contexts[key]["targetMeaning"]} for index, key in enumerate(keys)]
        returned = request_glosses(items, args.model)
        by_id = {int(item.get("i", -1)): str(item.get("z", "")) for item in returned if isinstance(item, dict)}
        for index, key in enumerate(keys):
            zh = to_tw(by_id.get(index, ""), converter).strip(" \"'。")
            if zh and HAN_RE.search(zh) and len(zh) <= 80:
                glosses[key] = zh
                cache[key] = zh
                accepted += 1
        save(payload, glosses, cache)
        print(json.dumps({"processed": min(offset + len(keys), len(missing)), "requested": len(missing), "acceptedThisRun": accepted}, ensure_ascii=False), flush=True)
    save(payload, glosses, cache)


if __name__ == "__main__":
    main()
