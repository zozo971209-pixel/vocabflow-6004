type EditorialEntry = {
  headword: string;
  correction?: { meaning: string; phonetic: string; note: string };
  primary: Record<string, string[]>;
  reason: string;
  sources: string[];
};

// Sense-level editorial choices, not word-frequency or exam-frequency claims.
// No entry means no automatic highlighting. Original vocab.json stays intact.
export const meaningEditorial: Record<number, EditorialEntry> = {
  1: {
    headword: "a/an",
    correction: {
      meaning: "art. 一個, 某個, 每一",
      phonetic: "ə / ən",
      note: "不定冠詞；a 用在子音音素前，an 用在母音音素前。",
    },
    primary: { art: ["一個", "某個"] },
    reason: "官方詞性為冠詞，採非特定單數事物用法；排除字母 A 與電腦縮寫的誤配。每一的用法保留顯示。",
    sources: ["https://dictionary.cambridge.org/grammar/british-grammar/a-an-the"],
  },
  188: {
    headword: "am/a.m.",
    correction: {
      meaning: "adv. 上午, 午前",
      phonetic: "ˌeɪˈem",
      note: "此詞條的官方詞性為副詞，指時間 a.m.；不是 I am 的 am。",
    },
    primary: { adv: ["上午", "午前"] },
    reason: "依官方 adv. 與 a.m. 拼寫判定為時間縮寫，修正誤查 be 動詞及電腦縮寫。",
    sources: ["https://www.dictionary.com/articles/what-do-am-and-pm-stand-for"],
  },
  3996: {
    headword: "pm/p.m.",
    correction: {
      meaning: "adv. 下午, 午後（包含晚間時段）",
      phonetic: "ˌpiːˈem",
      note: "p.m. 用於中午後至午夜前的時間，包括下午與晚上。",
    },
    primary: { adv: ["下午", "午後（包含晚間時段）"] },
    reason: "依官方 adv. 與 p.m. 拼寫選時間義，排除出納員及軍需官等不同縮寫。",
    sources: ["https://www.collinsdictionary.com/us/dictionary/english/pm"],
  },
  4057: {
    headword: "potential",
    primary: { adj: ["潛在的", "有潛力的"], n: ["潛力", "潛能", "可能性"] },
    reason: "Cambridge 與 Collins 學習字典收錄一般形容詞與名詞能力／可能性用法，標為 B2；物理專業義不標粗。B2 是學習難度證據，並非考試頻率。",
    sources: ["https://dictionary.cambridge.org/us/dictionary/english/potential", "https://www.collinsdictionary.com/dictionary/english/potential"],
  },
};

function normalizePos(pos: string) {
  const value = pos.replace(/\./g, "").toLowerCase();
  return value === "a" ? "adj" : value === "ad" ? "adv" : value;
}

export function isPrimaryMeaning(wordId: number, headword: string, pos: string, sense: string) {
  const entry = meaningEditorial[wordId];
  return entry?.headword === headword && Boolean(entry.primary[normalizePos(pos)]?.includes(sense));
}

export function applyMeaningEditorial<T extends { id: number; word: string; meaning: string; phonetic: string; note: string }>(word: T): T {
  const entry = meaningEditorial[word.id];
  return entry?.headword === word.word && entry.correction ? { ...word, ...entry.correction } : word;
}
