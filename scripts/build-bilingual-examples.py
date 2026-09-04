"""Build concise, sense-aligned English/Traditional-Chinese examples for VocabFlow.

Usage: python scripts/build-bilingual-examples.py <Tatoeba directory>
"""

from __future__ import annotations

import bz2
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "public" / "vocab.json"
ENRICHMENT_PATH = ROOT / "public" / "enrichment-ai.json"
OUTPUT_PATH = ROOT / "public" / "bilingual-examples.json"
TOKEN_RE = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")
TERMINAL_RE = re.compile(r"[.!?。！？]$")
FIELD_RE = re.compile(r"\[[^\]]+]\s*")
POS_LINE_RE = re.compile(r"^(vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num|aux|int|interj)\.\s*(.*)$", re.I)
NOISY_RE = re.compile(r"https?://|www\.|[_{}<>]|\.{3}|!{2,}|\?{2,}", re.I)
COMMON_NAMES = {"tom", "mary", "john", "bob", "alice", "jack", "jane", "mike", "sue", "sam", "scott", "jake", "peter", "david", "james", "jessica", "george", "henry", "paul", "robert", "william"}
GENERIC_ONE_CHAR = set("的了著過是有在為與及或而也就都把被給讓向從對於")
MAIN_POS = {"vt": "v", "vi": "v", "a": "adj", "ad": "adv", "int": "interj"}
REJECT_ZH_TERMS = ("為啥", "啥", "咋", "咱", "俺", "甭", "唄", "打的", "計算機", "軟件", "硬件", "視頻", "文件夾", "鼠標", "打印機", "出租汽車", "互聯網")
TAIWAN_REPLACEMENTS = {"計劃": "計畫", "視頻": "影片", "軟件": "軟體", "硬件": "硬體", "文件夾": "資料夾", "鼠標": "滑鼠", "打印機": "印表機", "互聯網": "網際網路", "出租汽車": "計程車", "大鹹": "太鹹"}
TAIWAN_REPLACEMENTS.update({"鐳射": "雷射", "澳大利亞": "澳洲"})
REJECT_SENTENCE_IDS = {303488, 4971602, 11290478, 13111924}
STOPWORDS = {
    "a", "an", "the", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "its", "our", "their", "this", "that", "these", "those", "who", "what", "which",
    "be", "am", "is", "are", "was", "were", "been", "being", "have", "has", "had", "do", "does", "did",
    "can", "could", "will", "would", "may", "might", "must", "should", "not", "to", "of", "in", "on", "at",
    "for", "from", "with", "by", "and", "or", "but", "if", "as", "than", "so", "very", "too", "only",
}
COMMON_ADJECTIVES = {"black", "blue", "brown", "green", "grey", "gray", "orange", "pink", "purple", "red", "white", "yellow", "new", "old", "good", "bad", "beautiful", "large", "small", "long", "short"}

# Function words are especially vulnerable to accidental one-character matches.
FUNCTION_TRANSLATIONS: dict[str, tuple[str, ...]] = {
    "i": ("我",), "you": ("你們", "你", "您"), "he": ("他",), "she": ("她",),
    "we": ("我們",), "they": ("他們", "她們", "它們"), "who": ("誰",),
    "what": ("什麼", "多麼"), "which": ("哪個", "哪些", "哪"),
    "this": ("這個", "這些", "這", "本", "這麼"), "that": ("那個", "那些", "那", "那麼"),
    "be": ("成為", "是", "在"), "have": ("擁有", "已經", "有"),
    "can": ("可以", "能夠", "能"), "could": ("可以", "能夠", "能"),
    "will": ("將會", "將", "會"), "would": ("願意", "將會", "會"),
    "may": ("也許", "可能", "可以"), "might": ("也許", "可能"),
    "must": ("必須", "一定"), "not": ("不是", "沒有", "不", "沒", "未"),
    "than": ("比",), "of": ("的", "之"), "dress": ("連身裙", "洋裝", "衣服", "服裝"),
    "a": ("一個", "一位", "一"), "an": ("一個", "一位", "一"),
}
FUNCTION_POS = {
    "i": "pron", "you": "pron", "he": "pron", "she": "pron", "we": "pron", "they": "pron",
    "who": "pron", "what": "pron", "which": "pron", "this": "pron", "that": "pron",
    "be": "v", "have": "v", "can": "aux", "could": "aux", "will": "aux", "would": "aux",
    "may": "aux", "might": "aux", "must": "aux", "not": "adv", "than": "conj", "of": "prep", "dress": "n", "a": "art", "an": "art",
}


def word_candidates(raw_word: str) -> list[str]:
    base = re.sub(r"\([^)]*\)", "", raw_word).replace(".", "").strip().lower()
    return list(dict.fromkeys(v for v in [base, *(p.strip() for p in base.split("/") if p.strip())] if v))


def normalize_pos(value: str) -> str:
    return MAIN_POS.get(value.lower(), value.lower())


def meaning_candidates(raw_meaning: str, converter: OpenCC) -> list[dict[str, object]]:
    values: list[dict[str, object]] = []
    order = 0
    for line in raw_meaning.replace("\\n", "\n").splitlines():
        line = line.strip()
        if not line or line.startswith("["):
            continue
        match = POS_LINE_RE.match(line)
        pos = normalize_pos(match.group(1)) if match else ""
        content = match.group(2) if match else FIELD_RE.sub("", line)
        for raw_value in re.split(r"[，,；;、]", content):
            value = converter.convert(raw_value.strip())
            value = re.sub(r"\([^)]*\)", "", value)
            value = re.sub(r"[.。…·\s]", "", value)
            value = re.sub(r"^(?:使|被|把)", "", value)
            if value and not re.search(r"[A-Za-z0-9]", value) and "..." not in value:
                values.append({"text": value, "pos": pos, "order": order})
                order += 1
    unique: dict[tuple[str, str], dict[str, object]] = {}
    for item in values:
        unique.setdefault((str(item["text"]), str(item["pos"])), item)
    return list(unique.values())


def normalize_taiwan_chinese(text: str) -> str:
    for source, target in TAIWAN_REPLACEMENTS.items():
        text = text.replace(source, target)
    text = re.sub(r",(?=\S)", "，", text)
    text = re.sub(r"\.$", "。", text)
    text = re.sub(r"\?$", "？", text)
    return re.sub(r"!$", "！", text)


def likely_english_pos(tokens: list[str], target_index: int) -> set[str]:
    token = tokens[target_index].lower()
    previous = tokens[target_index - 1].lower() if target_index else ""
    following = tokens[target_index + 1].lower() if target_index + 1 < len(tokens) else ""
    likely: set[str] = set()
    if token in {"have", "has", "had"} and following.endswith(("ed", "en")):
        likely.add("aux")
    elif previous == "to" or previous in {"can", "could", "will", "would", "may", "might", "must", "should"}:
        likely.add("v")
    if previous in COMMON_ADJECTIVES:
        likely.add("n")
    if previous in {"a", "an", "the", "this", "that", "my", "your", "his", "her", "our", "their"}:
        likely.add("adj" if following and following not in {"is", "are", "was", "were", "has", "have"} else "n")
    if following in {"is", "are", "was", "were", "has", "have"}:
        likely.add("n")
    if following in {"that", "which", "who", "whom"}:
        likely.add("n")
    if previous in {"very", "so", "too", "quite", "more", "most"}:
        likely.update(("adj", "adv"))
    return likely


def occurrences(text: str, target: str):
    start = text.find(target)
    while start >= 0:
        yield start
        start = text.find(target, start + 1)


def best_alignment(word: str, chinese: str, senses: list[dict[str, object]], likely_pos: set[str], english_ratio: float) -> tuple[str, str, int, int, int] | None:
    preferred = FUNCTION_TRANSLATIONS.get(word)
    candidates: list[tuple[int, int, str, str, int, int]] = []
    if preferred:
        for form_index, form in enumerate(preferred):
            for start in occurrences(chinese, form):
                end = start + len(form)
                chinese_ratio = (start + end) / max(1, 2 * len(chinese))
                score = min(len(form), 6) * 9 + 42 - form_index * 2
                score -= round(abs(english_ratio - chinese_ratio) * 22)
                pos = "aux" if word == "have" and form == "已經" else FUNCTION_POS.get(word, "")
                if likely_pos:
                    score += 18 if pos in likely_pos else -12
                candidates.append((score, len(form), form, pos, start, end))
        if not candidates:
            return None
        score, _length, target, pos, start, end = max(candidates)
        return target, pos, start, end, score

    for sense in senses:
        value, pos = str(sense["text"]), str(sense["pos"])
        for start in occurrences(chinese, value):
            if len(value) == 1 and value in GENERIC_ONE_CHAR:
                continue
            end = start + len(value)
            chinese_ratio = (start + end) / max(1, 2 * len(chinese))
            score = min(len(value), 6) * 9 + max(0, 18 - int(sense["order"]) * 2)
            if likely_pos and pos in likely_pos:
                score += 18
            elif likely_pos and pos:
                score -= 35
            score += 8
            score -= round(abs(english_ratio - chinese_ratio) * 30)
            # Avoid matching 道路 across the boundary in 知道 + 路.
            if value == "道路" and start > 0 and chinese[start - 1:start + 1] == "知道":
                score -= 60
            candidates.append((score, len(value), value, pos, start, end))
    if not candidates:
        return None
    score, _length, target, pos, start, end = max(candidates)
    return target, pos, start, end, score


def sentence_score(english: str, chinese: str, target_zh: str, alignment_score: int, token_levels: dict[str, int]) -> int:
    tokens = TOKEN_RE.findall(english)
    score = 100 + alignment_score - abs(len(tokens) - 9) * 4 - abs(len(chinese) - 17)
    if 5 <= len(tokens) <= 14:
        score += 24
    if 8 <= len(chinese) <= 32:
        score += 18
    if english[:1].isupper() and TERMINAL_RE.search(english) and TERMINAL_RE.search(chinese):
        score += 16
    if any(token.lower() in COMMON_NAMES for token in tokens):
        score -= 40
    if any(term in chinese for term in REJECT_ZH_TERMS):
        score -= 55
    for token in tokens:
        level = token_levels.get(token.lower())
        score -= 2 if level is None else (3 if level >= 5 else 0)
    if len(target_zh) == 1:
        score -= 5
    return score


def token_similarity(first: str, second: str) -> float:
    left, right = ({t.lower() for t in TOKEN_RE.findall(value)} for value in (first, second))
    return len(left & right) / max(1, len(left | right))


def translation_coverage(tokens: list[str], target: str, chinese: str, token_to_ids: dict[str, list[int]], meanings: dict[int, list[dict[str, object]]], base_words: dict[int, str]) -> tuple[int, int]:
    eligible = hits = 0
    for token in dict.fromkeys(value.lower() for value in tokens):
        if token == target or token in STOPWORDS or token not in token_to_ids:
            continue
        translations: set[str] = set()
        for word_id in token_to_ids[token]:
            preferred = FUNCTION_TRANSLATIONS.get(base_words[word_id])
            if preferred:
                translations.update(preferred)
            else:
                translations.update(
                    str(item["text"]) for item in meanings[word_id]
                    if str(item["text"]) and not (len(str(item["text"])) == 1 and str(item["text"]) in GENERIC_ONE_CHAR)
                )
        if not translations:
            continue
        eligible += 1
        if any(value in chinese for value in translations):
            hits += 1
    return hits, eligible


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("請提供 Tatoeba 下載資料夾路徑。")
    source_dir = Path(sys.argv[1]).resolve()
    required = {name: source_dir / filename for name, filename in {
        "english": "eng_sentences.tsv.bz2", "chinese": "cmn_sentences.tsv.bz2", "links": "eng-cmn_links.tsv.bz2"}.items()}
    missing = [str(path) for path in required.values() if not path.exists()]
    if missing:
        raise SystemExit(f"缺少 Tatoeba 檔案：{', '.join(missing)}")

    converter = OpenCC("s2twp")
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    enrichment = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))
    token_to_ids: dict[str, list[int]] = defaultdict(list)
    token_levels: dict[str, int] = {}
    meanings: dict[int, list[dict[str, object]]] = {}
    base_words: dict[int, str] = {}
    for item in vocab:
        word_id = int(item["id"])
        source_words = word_candidates(str(item["word"]))
        base_words[word_id] = source_words[0] if source_words else str(item["word"]).lower()
        meanings[word_id] = meaning_candidates(str(item["meaning"]), converter)
        forms = enrichment.get("words", {}).get(str(word_id), {}).get("forms", [])
        for candidate in dict.fromkeys([*source_words, *(str(v).lower() for v in forms)]):
            if " " not in candidate and "-" not in candidate:
                token_to_ids[candidate].append(word_id)
                token_levels[candidate] = min(int(item["level"]), token_levels.get(candidate, 6))

    links: dict[int, list[int]] = defaultdict(list)
    with bz2.open(required["links"], "rt", encoding="utf-8") as source:
        for line in source:
            english_id, chinese_id = line.rstrip("\n").split("\t")[:2]
            links[int(english_id)].append(int(chinese_id))

    needed_chinese_ids = {value for values in links.values() for value in values}
    chinese_sentences: dict[int, str] = {}
    with bz2.open(required["chinese"], "rt", encoding="utf-8") as source:
        for line in source:
            sentence_id, _language, text = line.rstrip("\n").split("\t", 2)
            numeric_id = int(sentence_id)
            if numeric_id in needed_chinese_ids:
                chinese_sentences[numeric_id] = normalize_taiwan_chinese(converter.convert(text.strip()))

    selections: dict[int, list[tuple[int, dict[str, object]]]] = defaultdict(list)
    with bz2.open(required["english"], "rt", encoding="utf-8") as source:
        for line in source:
            sentence_id, _language, english = line.rstrip("\n").split("\t", 2)
            numeric_id = int(sentence_id)
            if numeric_id not in links or numeric_id in REJECT_SENTENCE_IDS or NOISY_RE.search(english):
                continue
            token_matches = list(TOKEN_RE.finditer(english))
            tokens = [match.group(0) for match in token_matches]
            if not 4 <= len(tokens) <= 18 or not TERMINAL_RE.search(english):
                continue
            if any(token[:1].isupper() and token != "I" for token in tokens[1:]) or any(token.lower() in COMMON_NAMES for token in tokens):
                continue
            for token_index, match in enumerate(token_matches):
                normalized_target = match.group(0).lower()
                if normalized_target not in token_to_ids:
                    continue
                for word_id in token_to_ids[normalized_target]:
                    likely_pos = likely_english_pos(tokens, token_index)
                    for chinese_id in links[numeric_id]:
                        chinese = chinese_sentences.get(chinese_id, "")
                        if not chinese or len(chinese) > 45 or not TERMINAL_RE.search(chinese) or NOISY_RE.search(chinese):
                            continue
                        english_ratio = (match.start() + match.end()) / max(1, 2 * len(english))
                        alignment_word = normalized_target if normalized_target in FUNCTION_TRANSLATIONS else base_words[word_id]
                        alignment = best_alignment(alignment_word, chinese, meanings[word_id], likely_pos, english_ratio)
                        if not alignment:
                            continue
                        coverage_hits, coverage_total = translation_coverage(
                            tokens, normalized_target, chinese, token_to_ids, meanings, base_words
                        )
                        if (coverage_total == 1 and coverage_hits == 0) or (coverage_total >= 2 and coverage_hits / coverage_total <= 0.5):
                            continue
                        target_zh, pos, zh_start, zh_end, alignment_score = alignment
                        quality_score = sentence_score(english, chinese, target_zh, alignment_score, token_levels)
                        if quality_score < 150:
                            continue
                        record = {
                            "en": english.strip(), "zh": chinese,
                            "enStart": match.start(), "enEnd": match.end(), "zhStart": zh_start, "zhEnd": zh_end,
                            "targetEn": match.group(0), "targetZh": target_zh, "senseZh": target_zh, "pos": pos,
                            "qualityScore": min(100, max(1, round((quality_score - 120) / 1.4))),
                            "englishSentenceId": numeric_id, "chineseSentenceId": chinese_id,
                        }
                        selections[word_id].append((quality_score, record))

    words: dict[str, list[dict[str, object]]] = {}
    total_examples = 0
    for word_id, ranked in selections.items():
        ranked.sort(key=lambda item: (item[0], -len(str(item[1]["en"]))), reverse=True)
        chosen: list[dict[str, object]] = []
        seen: set[tuple[str, str]] = set()
        for _score, record in ranked:
            key = (str(record["en"]), str(record["zh"]))
            if key in seen or any(token_similarity(str(record["en"]), str(item["en"])) >= 0.72 for item in chosen):
                continue
            if chosen and record["targetZh"] == chosen[0]["targetZh"] and record["pos"] == chosen[0]["pos"]:
                continue
            seen.add(key)
            chosen.append(record)
            if len(chosen) == 2:
                break
        if chosen:
            words[str(word_id)] = chosen
            total_examples += len(chosen)

    payload = {
        "schemaVersion": 2, "generatedAt": date.today().isoformat(),
        "notice": "例句取自 Tatoeba 英中句對，已通過完整句、臺灣繁中、詞義對應、難度、自然度與重複度等自動品質檢查；本站以自動嚴格篩選取代逐句人工核對。",
        "source": {"title": "Tatoeba", "url": "https://tatoeba.org/", "license": "CC BY 2.0 FR", "licenseUrl": "https://creativecommons.org/licenses/by/2.0/fr/"},
        "stats": {"totalWords": len(vocab), "wordsWithExamples": len(words), "totalExamples": total_examples}, "words": words,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
