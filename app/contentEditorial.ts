import type { AiEnrichmentWord } from "./aiEnrichment";
import type { BilingualExample } from "./bilingualExamples";

type Pair = [english: string, chinese: string];
type Example = [english: string, chinese: string, targetEnglish: string, targetChinese: string, pos: string];
type ContentEdit = {
  headword: string;
  collocations: Pair[];
  family: Pair[];
  phrases: Pair[];
  synonyms: [english: string, chinese: string, distinction: string][];
  antonyms: Pair[];
  usage: string[];
  examples: Example[];
};

// AI editorial revisions. These are not human-reviewed or frequency statistics.
// Keep raw source datasets intact; IDs and the daily learning order never change.
export const contentEditorial: Record<number, ContentEdit> = {
  1: {
    headword: "a/an", family: [], phrases: [["once a week", "每週一次"]], synonyms: [], antonyms: [],
    collocations: [["a book", "一本書"], ["an apple", "一顆蘋果"], ["an hour", "一小時"]],
    usage: ["不定冠詞，放在單數可數名詞前。a／an 依下一個字的發音選擇，不是只看第一個字母。", "a university（/j/ 子音起首）；an hour（h 不發音）。"],
    examples: [["I bought a book yesterday.", "我昨天買了一本書。", "a", "一本", "art"], ["She ate an apple after lunch.", "她午餐後吃了一顆蘋果。", "an", "一顆", "art"]],
  },
  188: {
    headword: "am/a.m.", family: [], phrases: [], synonyms: [], antonyms: [["p.m.", "中午後至午夜前（包括下午與晚上）"]],
    collocations: [["at 8 a.m.", "在上午八點"], ["from 9 a.m. to noon", "從上午九點到中午"]],
    usage: ["本詞條是時間縮寫，不是 I am 的 be 動詞。a.m. 用於午夜後至中午前；為避免 12 a.m.／12 p.m. 混淆，直接用 midnight／noon 更清楚。"],
    examples: [["Our first class starts at 8 a.m.", "我們的第一堂課在上午八點開始。", "a.m.", "上午", "adv"]],
  },
  3996: {
    headword: "pm/p.m.", family: [], phrases: [], synonyms: [], antonyms: [["a.m.", "上午；午夜後至中午前"]],
    collocations: [["at 3 p.m.", "在下午三點"], ["until 9 p.m.", "直到晚上九點"]],
    usage: ["p.m. 用於中午後至午夜前，8 p.m. 是晚上八點，不是下午八點。此詞條不採 PM 的其他縮寫義。"],
    examples: [["The library closes at 9 p.m.", "圖書館在晚上九點關門。", "p.m.", "晚上", "adv"]],
  },
  725: {
    headword: "can", family: [["canned", "罐裝的"]], phrases: [["a can of soup", "一罐湯"]],
    collocations: [["can swim", "會游泳"], ["a drinks can", "飲料罐"]],
    synonyms: [["be able to", "能夠", "用來表達能力；can 是助動詞，be able to 可配合不同時態，如 will be able to。"], ["tin", "罐；罐頭", "英式英語中可指金屬罐；只對應 can 的名詞義，不是「能夠」。"]],
    antonyms: [], usage: ["助動詞 can 後接原形動詞，不加 to。", "名詞 can 是可數名詞：one can／two cans。動詞 can（裝罐）的過去式為 canned。"],
    examples: [["My younger brother can swim now.", "我弟弟現在會游泳了。", "can", "會", "aux"], ["Please put the empty can in the recycling bin.", "請把空罐放進回收桶。", "can", "罐", "n"]],
  },
  5918: {
    headword: "will", family: [["willing", "願意的"], ["willingness", "意願"]],
    collocations: [["will arrive tomorrow", "明天會到達"], ["the will to succeed", "成功的決心"]],
    phrases: [["make a will", "立遺囑"]], synonyms: [["determination", "決心", "對應 will 的意志／決心義，強調持續追求目標，不可替換表示未來的助動詞 will。"]], antonyms: [],
    usage: ["助動詞 will 後接原形動詞。意志／決心通常不可數；遺囑是可數名詞（a will）。"],
    examples: [["I will call you after dinner.", "我晚餐後會打電話給你。", "will", "會", "aux"], ["She has a strong will to succeed.", "她有強烈的成功決心。", "will", "決心", "n"]],
  },
  5696: {
    headword: "use", family: [["useful", "有用的"], ["useless", "無用的"], ["user", "使用者"]],
    collocations: [["use a computer", "使用電腦"], ["make good use of time", "善用時間"]],
    phrases: [["use up", "用完；耗盡"], ["be of use", "有用處"]],
    synonyms: [["utilize", "利用；使用", "比 use 正式，常強調有效運用可用的資源；日常敘述通常直接用 use。"], ["usage", "用法；使用情形", "是名詞，常指語言用法或實際使用方式；不能替換動詞 use。"]], antonyms: [],
    usage: ["動詞 use 的字尾發 /z/；名詞 use 的字尾發 /s/。", "使用這個行為常不可數（the use of）；用途可數（many uses）。"],
    examples: [["You can use my computer to finish your homework.", "你可以使用我的電腦完成作業。", "use", "使用", "v"], ["This map will be of great use to us.", "這張地圖對我們會很有用處。", "use", "用處", "n"]],
  },
  3125: {
    headword: "live", family: [["living", "活著的；生活"], ["livable", "適合居住的"]],
    collocations: [["live in Taipei", "住在臺北"], ["a live broadcast", "現場直播"]],
    phrases: [["live on", "靠……維生；繼續存在"]],
    synonyms: [["reside", "居住", "比 live 正式，對應居住義；不表示現場直播。"], ["alive", "活著的", "通常放在 be 等動詞後，例如 is alive；修飾名詞前的「活的」常用 live，如 live fish。"]],
    antonyms: [["dead", "死的"], ["recorded", "預先錄製的（與現場播送相對）"]],
    usage: ["動詞 live（居住／生活）讀 /lɪv/；形容詞 live（活的／現場的）讀 /laɪv/。"],
    examples: [["My grandparents live near the station.", "我的祖父母住在車站附近。", "live", "住", "v"], ["We watched a live broadcast of the concert.", "我們看了那場演唱會的現場直播。", "live", "現場", "adj"]],
  },
  3366: {
    headword: "minute", family: [], phrases: [["just a minute", "請稍等一下"]],
    collocations: [["in a few minutes", "幾分鐘後"], ["a ten-minute walk", "步行十分鐘的路程"]],
    synonyms: [["moment", "片刻", "表示短暫但不確定的時間；minute 作計時單位時是確切的六十秒。"]], antonyms: [],
    usage: ["本詞表列名詞 minute（/ˈmɪnɪt/，分鐘），可數。形容詞 minute（/maɪˈnjuːt/，極小的）是不同發音與詞義，不能混用。"],
    examples: [["Please wait here for a minute.", "請在這裡等一分鐘。", "minute", "分鐘", "n"]],
  },
  4047: {
    headword: "possible", family: [["possibility", "可能性；可能發生的事"], ["possibly", "可能；也許"]],
    collocations: [["a possible solution", "一個可能的解決辦法"], ["as soon as possible", "盡快"]],
    phrases: [["if possible", "如果可能的話"]],
    synonyms: [["potential", "潛在的", "possible 強調事情有可能發生或辦到；potential 著重尚未實現、但有發展條件的事物。"], ["feasible", "可行的", "強調在現有條件下實際做得到，比單純 possible 更著重實行條件。"]],
    antonyms: [["impossible", "不可能的"]], usage: ["形容詞。常用句型：It is possible to + 原形動詞；It is possible that + 子句。"],
    examples: [["Is it possible to finish the work today?", "今天有可能完成這項工作嗎？", "possible", "有可能", "adj"]],
  },
  4046: {
    headword: "possibility", family: [["possible", "可能的"], ["possibly", "可能；也許"]],
    collocations: [["a real possibility", "確實存在的可能性"], ["consider every possibility", "考慮每一種可能情況"]],
    phrases: [["the possibility of rain", "下雨的可能性"]],
    synonyms: [["chance", "可能性；機會", "表示事情發生的可能性時可近義，但 chance 也表示做某事的機會。"], ["likelihood", "可能性", "著重事情發生的可能程度；possibility 也可以指某個可能的選項或結果。"], ["possibleness", "可能性", "是表示「可能這種性質」的名詞；學習與一般寫作可優先使用 possibility，不應把兩字當成固定搭配。"]],
    antonyms: [["impossibility", "不可能；不可能的事"]], usage: ["可數與不可數皆有。具體的一種可能結果可用 a possibility；多種可能性用 possibilities。後面可接 of + 名詞／動名詞或 that 子句。"],
    examples: [["There is a possibility of rain this afternoon.", "今天下午有下雨的可能性。", "possibility", "可能性", "n"]],
  },
  4057: {
    headword: "potential", family: [["potentially", "潛在地；可能地"], ["potentiality", "潛力；潛在可能性"]],
    collocations: [["a potential problem", "一個潛在問題"], ["reach your full potential", "充分發揮你的潛力"], ["potential customers", "潛在顧客"]],
    phrases: [["have the potential to", "有潛力……；有可能……"]],
    synonyms: [["possible", "可能的", "possible 指有可能發生；potential 特別強調目前尚未實現的發展或風險。"], ["capacity", "能力；容量", "對應能力時近義，但 capacity 也指可容納的量；potential 著重尚可發展的能力。"]],
    antonyms: [["actual", "實際的；已存在的"]], usage: ["形容詞常放在名詞前。名詞表示潛力時通常不可數：great potential，而不是 a great potential。物理學的電位是另一專業詞義。"],
    examples: [["She has the potential to become a great teacher.", "她有成為優秀教師的潛力。", "potential", "潛力", "n"], ["We need to discuss a potential problem.", "我們需要討論一個潛在的問題。", "potential", "潛在的", "adj"]],
  },
};

export function editedExamples(wordId: number): BilingualExample[] | undefined {
  return contentEditorial[wordId]?.examples.map(([en, zh, targetEn, targetZh, pos]) => {
    // Match a complete English token, not the letter a inside another word.
    const escaped = targetEn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i").exec(en);
    const enStart = match?.index ?? -1;
    const zhStart = zh.indexOf(targetZh);
    return { en, zh, targetEn: match?.[0] ?? targetEn, targetZh, enStart, enEnd: enStart + targetEn.length, zhStart, zhEnd: zhStart + targetZh.length, pos, senseZh: targetZh, origin: "ai-generated", qualityScore: 0 };
  });
}

export function editedEnrichment(wordId: number, original: AiEnrichmentWord | undefined): AiEnrichmentWord | undefined {
  const edit = contentEditorial[wordId];
  if (!edit) return original;
  const pairs = [...edit.collocations, ...edit.family, ...edit.phrases, ...edit.synonyms, ...edit.antonyms];
  return { ...original, definitions: [], forms: original?.forms ?? [], examples: [],
    family: edit.family.map(pair => pair[0]), collocations: edit.collocations.map(pair => pair[0]), phrases: edit.phrases.map(pair => pair[0]), synonyms: edit.synonyms.map(pair => pair[0]), antonyms: edit.antonyms.map(pair => pair[0]), usage: edit.usage,
    glosses: Object.fromEntries(pairs.map(([en, zh]) => [en.toLowerCase(), zh])),
    synonymNotes: Object.fromEntries(edit.synonyms.map(([en, , note]) => [en, note])),
  };
}
