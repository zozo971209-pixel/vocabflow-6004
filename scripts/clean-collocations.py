"""Keep only complete, source-backed collocations or explicit safe overrides.

The enrichment builder extracts a five-token window around a target word. This
script rejects those clipped windows and all mechanical fallback labels. A
collocation is retained only when it equals a complete WordNet example or is a
small explicit override maintained by this project.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENRICHMENT_PATH = ROOT / "public" / "enrichment-ai.json"
MECHANICAL_RE = re.compile(
    r"[（(](?:動詞原形練習|形容詞句型練習|名詞片語練習|請搭配完整句子理解)[）)]"
)
SAFE_OVERRIDES = {
    "1": {"a book", "an apple"},
    "188": {"at 8 a.m."},
    "3996": {"at 3 p.m."},
}


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value).replace("_", " ").strip().lower())


def save_json(path: Path, value: object) -> None:
    serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    temporary = path.with_suffix(path.suffix + ".tmp")
    for attempt in range(6):
        try:
            temporary.write_text(serialized, encoding="utf-8")
            os.replace(temporary, path)
            return
        except OSError:
            if attempt == 5:
                raise
            time.sleep(0.25 * (attempt + 1))


def main() -> None:
    payload = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))
    before = 0
    kept = 0
    removed_mechanical = 0
    removed_clipped = 0

    for word_id, word_data in payload["words"].items():
        original = word_data.get("collocations", [])
        examples = {
            normalize(example.get("en", ""))
            for example in word_data.get("examples", [])
            if isinstance(example, dict) and example.get("en")
        }
        overrides = SAFE_OVERRIDES.get(word_id, set())
        cleaned = []
        for phrase in original:
            before += 1
            normalized = normalize(phrase)
            if MECHANICAL_RE.search(phrase):
                removed_mechanical += 1
            elif normalized in examples or normalized in overrides:
                cleaned.append(phrase)
                kept += 1
            else:
                removed_clipped += 1
        word_data["collocations"] = cleaned

    save_json(ENRICHMENT_PATH, payload)
    print(json.dumps({
        "before": before,
        "kept": kept,
        "removed": before - kept,
        "removedMechanical": removed_mechanical,
        "removedClipped": removed_clipped,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
