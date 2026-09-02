"""Build compact, reproducible common-word evidence from ECDICT.

Usage:
    python scripts/build-usage-evidence.py path/to/ecdict.csv
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "public" / "vocab.json"
OUTPUT_PATH = ROOT / "public" / "usage-evidence.json"


def integer(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def candidates(word: str) -> list[str]:
    normalized = word.strip().lower()
    values = [normalized]
    if "/" in normalized:
        values.extend(part.strip() for part in normalized.split("/") if part.strip())
    return list(dict.fromkeys(values))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("請提供 ECDICT CSV 路徑。")

    source_path = Path(sys.argv[1]).resolve()
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    lookup = {
        candidate: item
        for item in vocab
        for candidate in candidates(str(item["word"]))
    }
    matched: dict[str, dict[str, str]] = {}

    with source_path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            key = str(row.get("word", "")).strip().lower()
            if key in lookup:
                matched[key] = row

    evidence: dict[str, dict[str, object]] = {}
    matched_word_ids: set[int] = set()
    for item in vocab:
        row = next((matched[key] for key in candidates(str(item["word"])) if key in matched), None)
        if row is None:
            continue

        matched_word_ids.add(int(item["id"]))
        collins = integer(row.get("collins"))
        bnc = integer(row.get("bnc"))
        contemporary = integer(row.get("frq"))
        reasons: list[str] = []

        # Deliberately strict: one established learner-list signal, a very high
        # Collins rating, or a top-3000 corpus rank is required.
        if row.get("oxford") == "1":
            reasons.append("oxford3000")
        if collins >= 4:
            reasons.append("collins4plus")
        if 0 < bnc <= 3000:
            reasons.append("bncTop3000")
        if 0 < contemporary <= 3000:
            reasons.append("contemporaryTop3000")

        if reasons:
            evidence[str(item["id"])] = {
                "common": True,
                "basis": reasons,
                "sourceWord": row["word"],
                "ranks": {"bnc": bnc or None, "contemporary": contemporary or None},
                "collins": collins or None,
            }

    payload = {
        "schemaVersion": 1,
        "generatedAt": date.today().isoformat(),
        "methodology": {
            "common": "Oxford 3000、Collins 4–5 星，或 BNC／當代語料庫排名前 3,000；符合任一條件即標為常用。",
            "meaning": "來源只能證明單字層級的常用度。只有該詞性在本站恰有一個核心中文義項時，才將該義項粗體；多義詞不推測特定義項。",
            "exam": "尚未加入臺灣大考中心歷屆試題逐題核對資料，因此不標示常考。",
        },
        "source": {
            "title": "ECDICT",
            "url": "https://github.com/skywind3000/ECDICT",
            "license": "MIT",
            "licenseUrl": "https://github.com/skywind3000/ECDICT/blob/master/LICENSE",
        },
        "stats": {
            "totalWords": len(vocab),
            "matchedWords": len(matched_word_ids),
            "commonWords": len(evidence),
        },
        "words": evidence,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
