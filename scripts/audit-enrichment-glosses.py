"""Audit local-AI English/Chinese gloss pairs with multilingual embeddings."""

from __future__ import annotations

import argparse
import json
import math
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "outputs" / "enrichment-gloss-cache.json"


def embeddings(values: list[str], model: str) -> list[list[float]]:
    body = json.dumps({"model": model, "input": values, "truncate": True, "keep_alive": "10m"}).encode("utf-8")
    request = urllib.request.Request("http://127.0.0.1:11434/api/embed", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode("utf-8"))["embeddings"]


def cosine(left: list[float], right: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right))
    denominator = math.sqrt(sum(a * a for a in left) * sum(b * b for b in right))
    return numerator / denominator if denominator else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="embeddinggemma:latest")
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--threshold", type=float, default=0.52)
    parser.add_argument("--prune", action="store_true")
    args = parser.parse_args()

    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    pairs = list(cache.items())
    scored: list[tuple[float, str, str]] = []
    for offset in range(0, len(pairs), args.batch_size):
        batch = pairs[offset:offset + args.batch_size]
        vectors = embeddings([value for pair in batch for value in pair], args.model)
        scored.extend((cosine(vectors[index * 2], vectors[index * 2 + 1]), en, zh) for index, (en, zh) in enumerate(batch))
        print(json.dumps({"processed": min(offset + len(batch), len(pairs)), "total": len(pairs)}, ensure_ascii=False), flush=True)

    rejected = [(score, en, zh) for score, en, zh in scored if score < args.threshold]
    if args.prune:
        for _, en, _ in rejected:
            cache.pop(en, None)
        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    scores = sorted(score for score, _, _ in scored)
    report = {
        "total": len(scored), "threshold": args.threshold, "rejected": len(rejected),
        "minimum": scores[0] if scores else None,
        "median": scores[len(scores) // 2] if scores else None,
        "lowest": [{"score": round(score, 4), "en": en, "zh": zh} for score, en, zh in sorted(scored)[:40]],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
