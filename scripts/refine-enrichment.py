"""Reconcile enrichment with source POS/senses; never use generated sentence frames.

Default is a preview under outputs/. --apply updates the derived public dataset.
The input dataset is archived once, and its SHA256 is recorded in the report.
"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
CC = OpenCC("s2twp")
POS = {"a": "形容詞", "s": "形容詞", "n": "名詞", "v": "動詞", "r": "副詞"}


def norm(value):
    return re.sub(r"\s+", " ", str(value).replace("_", " ").lower()).strip()


def variants(word):
    base = re.sub(r"\([^)]*\)", "", word)
    return list(dict.fromkeys(norm(x).replace(".", "") for x in [word, base, *base.split("/")]))


def senses_zh(raw, part=None):
    results = []
    for line in str(raw).replace("\\n", "\n").splitlines():
        line = line.strip()
        if line.startswith("["):
            continue
        match = re.match(r"^(vt|vi|v|n|a|adj|ad|adv|prep|pron|conj|art|aux|num)\.\s*(.*)", line, re.I)
        if not match:
            continue
        label = {"vt": "v", "vi": "v", "adj": "a", "adv": "r", "ad": "r"}.get(match[1], match[1])
        if part and part != label:
            continue
        text = re.sub(r"\([^)]*\)|\[[^]]*\]", "", match[2])
        results.extend(CC.convert(x.strip()) for x in re.split(r"[,;，；、]", text) if x.strip())
    return list(dict.fromkeys(results))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wordnet_dir", type=Path)
    parser.add_argument("ecdict_csv", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    path = ROOT / "public/enrichment-ai.json"
    raw = path.read_bytes()
    payload = json.loads(raw)
    bilingual = json.loads((ROOT / "public/bilingual-examples.json").read_text(encoding="utf-8"))
    edited_glosses = {}
    for line in (ROOT / "scripts/data/enrichment-gloss-edits.tsv").read_text(encoding="utf-8").splitlines():
        if line.strip():
            en, zh = line.split("\t", 1)
            edited_glosses[norm(en)] = CC.convert(zh)
    vocab = json.loads((ROOT / "public/vocab.json").read_text(encoding="utf-8"))
    entries, synsets = {}, {}
    for source in args.wordnet_dir.glob("*.json"):
        if source.name.startswith("entries-"):
            entries.update(json.loads(source.read_text(encoding="utf-8")))
        elif re.match(r"^(noun|verb|adj|adv)\.", source.name):
            synsets.update(json.loads(source.read_text(encoding="utf-8")))
    dictionary = {}
    with args.ecdict_csv.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            dictionary[norm(row["word"])] = row.get("translation", "")
    report = {"sourceSha256": hashlib.sha256(raw).hexdigest(), "words": len(vocab), "removedFalsePhrases": 0, "removedWrongPosSynonyms": 0, "removedFramesOrWrongPosCollocations": 0, "addedSourceExamples": 0, "addedDictionaryGlosses": 0, "contextualSynonymNotes": 0, "missingGlosses": [], "source": "https://en-word.net/static/english-wordnet-2025-json.zip", "dictionary": "https://github.com/skywind3000/ECDICT", "limitations": "Source/POS/structure checks are not exhaustive naturalness, translation or frequency verification."}
    for word in vocab:
        data = payload["words"][str(word["id"])]
        # The UI section is "collocations and sentence patterns". When the
        # dictionary has no short collocation, retain one complete bilingual
        # sentence instead of manufacturing a clipped token window.
        if not data.get("collocations"):
            candidates = [item for item in bilingual.get("words", {}).get(str(word["id"]), [])
                          if isinstance(item, dict) and item.get("en") and item.get("zh") and 4 <= len(item["en"].split()) <= 18]
            if candidates:
                chosen = candidates[0]
                data["collocations"] = [chosen["en"]]
                payload["glosses"][norm(chosen["en"])] = chosen["zh"]
        keys = variants(word["word"])
        entry = next((entries[k] for k in keys if k in entries), {})
        official = set()
        for p in re.findall(r"[a-z]+", word["pos"].lower()):
            official.add({"adj": "a", "adv": "r", "vt": "v", "vi": "v"}.get(p, p))
        relevant = [(p, sense, synsets.get(sense["synset"], {})) for p, value in entry.items() if p in official or (p == "s" and "a" in official) for sense in value.get("sense", [])]
        permitted = {}
        natural = []
        for part, sense, synset in relevant:
            for member in synset.get("members", []):
                permitted.setdefault(norm(member), []).append((part, sense["synset"], synset.get("definition", [])))
            for example in synset.get("example", []):
                text = example if isinstance(example, str) else example.get("text", "")
                if text and text not in natural:
                    natural.append(text)
        target_forms = list(dict.fromkeys(keys + [norm(form) for p, value in entry.items() if p in official for form in value.get("form", [])]))

        def contains_target(phrase):
            return any(re.search(r"(?<![a-z])" + re.escape(key) + r"(?![a-z])", norm(phrase)) for key in target_forms if key)

        original_phrases = data.get("phrases", [])
        data["phrases"] = [x for x in original_phrases if contains_target(x)]
        report["removedFalsePhrases"] += len(original_phrases) - len(data["phrases"])
        if entry and relevant:
            original_synonyms = data.get("synonyms", [])
            data["synonyms"] = [x for x in original_synonyms if norm(x) in permitted]
            report["removedWrongPosSynonyms"] += len(original_synonyms) - len(data["synonyms"])
            valid_collocations = [x for x in data.get("collocations", []) if x in natural]
            report["removedFramesOrWrongPosCollocations"] += len(data.get("collocations", [])) - len(valid_collocations)
            for example in natural:
                # Retain a complete source example, never a token window.
                if len(valid_collocations) >= 3:
                    break
                if example not in valid_collocations and contains_target(example) and 2 <= len(example.split()) <= 12 and norm(example) in payload["glosses"]:
                    valid_collocations.append(example)
                    report["addedSourceExamples"] += 1
            data["collocations"] = valid_collocations
        notes, contexts = {}, {}
        for synonym in data.get("synonyms", []):
            related = senses_zh(dictionary.get(norm(synonym), ""))
            for part, synset_id, definitions in permitted.get(norm(synonym), []):
                ours = senses_zh(word["meaning"], part)
                theirs = senses_zh(dictionary.get(norm(synonym), ""), part)
                shared = [x for x in ours if len(x) >= 2 and x in theirs]
                contexts.setdefault(synonym, []).append({"pos": part, "synsetId": synset_id, "definitionEn": definitions})
                if shared and synonym not in notes:
                    extras = [x for x in related if x not in shared and len(x) >= 2][:2]
                    notes[synonym] = f"詞義對照：兩字的{POS.get(part, part)}釋義都收錄「{'、'.join(shared[:2])}」。"
                    if extras:
                        notes[synonym] += f"{synonym} 另收錄「{'、'.join(extras)}」。這是字典詞義比較，不代表各種語境都能替換。"
                    else:
                        notes[synonym] += "是否能替換仍須看句型與上下文；這不是使用頻率排序。"
                    report["contextualSynonymNotes"] += 1
        if notes:
            data["synonymNotes"] = notes
        if contexts:
            data["synonymSources"] = contexts
        for category in ["family", "collocations", "synonyms", "phrases", "antonyms"]:
            for text in data.get(category, []):
                key = norm(text)
                if key in edited_glosses:
                    payload["glosses"][key] = edited_glosses[key]
                    continue
                if key in payload["glosses"]:
                    continue
                gloss = senses_zh(dictionary.get(key, ""))
                if gloss:
                    payload["glosses"][key] = "、".join(gloss[:4])
                    report["addedDictionaryGlosses"] += 1
                else:
                    report["missingGlosses"].append({"wordId": word["id"], "headword": word["word"], "category": category, "english": text})
    output = ROOT / "outputs"
    output.mkdir(exist_ok=True)
    archive = output / "enrichment-before-refinement.json"
    if not archive.exists():
        archive.write_bytes(raw)
    payload["refinement"] = {"source": report["source"], "sourcePosChecked": True, "glossEditorialFile": "scripts/data/enrichment-gloss-edits.tsv", "notice": "新增中文為字典輔助或 AI 編輯；自動詞義對照不是語料頻率，也不保證同義詞能在各種語境互換。"}
    (output / "enrichment-refinement-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (path if args.apply else output / "enrichment-refinement-preview.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({**report, "missingGlosses": len(report["missingGlosses"]), "applied": args.apply}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
