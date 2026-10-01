import fs from "node:fs";

const root = process.cwd();
const vocab = JSON.parse(fs.readFileSync(`${root}/public/vocab.json`, "utf8"));
const bilingual = JSON.parse(fs.readFileSync(`${root}/public/bilingual-examples.json`, "utf8"));
const sourceExamples = JSON.parse(fs.readFileSync(`${root}/public/source-examples.json`, "utf8"));
const cache = JSON.parse(fs.readFileSync(`${root}/outputs/ai-example-cache.json`, "utf8"));
const outputPath = `${root}/public/ai-example-fallbacks.json`;

// These are the final source-missing entries that were not present in the
// resumable local draft cache. They remain explicitly marked as AI drafts.
const MANUAL_COMPLETIONS = {
  5934: ["The novel portrays a young witch who protects her village.", "這部小說描寫一名保護村莊的年輕女巫。", "witch", "女巫"],
  5077: ["A squirrel disappeared into the branches of the old tree.", "一隻松鼠消失在老樹的枝葉間。", "squirrel", "松鼠"],
  341: ["A single atom is far too small to see without special equipment.", "單一原子太小了，沒有特殊設備便無法看見。", "atom", "原子"],
  3704: ["The charity provided a safe home for the orphan.", "那個慈善機構為這名孤兒提供了安全的家。", "orphan", "孤兒"],
  4133: ["The office printer is out of paper again.", "辦公室的印表機又沒紙了。", "printer", "印表機"],
  5102: ["Wild animals can starve during a long drought.", "野生動物可能在長期乾旱期間餓死。", "starve", "餓死"],
  5119: ["The bridge is reinforced with steel to withstand earthquakes.", "這座橋以鋼材加固，以承受地震。", "steel", "鋼材"],
  3712: ["The outcome of the experiment surprised the research team.", "實驗結果讓研究團隊感到意外。", "outcome", "結果"],
  5145: ["He stayed home because a stomachache made it difficult to concentrate.", "他因為胃痛而待在家裡，難以集中注意力。", "stomachache", "胃痛"],
  704: ["The medicine is stored in a locked cabinet.", "藥品存放在上鎖的櫥櫃裡。", "cabinet", "櫥櫃"],
  2866: ["The invention changed how people communicated across long distances.", "這項發明改變了人們跨越長距離溝通的方式。", "invention", "發明"],
  712: ["The program can calculate the total cost within seconds.", "這個程式能在幾秒內計算出總費用。", "calculate", "計算"],
  1327: ["She sliced a cucumber and added it to the salad.", "她把小黃瓜切片後加進沙拉裡。", "cucumber", "小黃瓜"],
  2462: ["The restaurant served baked ham with roasted vegetables.", "那家餐廳供應烤火腿和烤蔬菜。", "ham", "火腿"],
  407: ["The fisherman used worms as bait for the river fish.", "那名漁夫用蚯蚓作為河魚的餌。", "bait", "餌"],
  1355: ["Passengers must declare valuable goods at customs.", "旅客必須在海關申報貴重物品。", "customs", "海關"],
  417: ["The pandas spent most of the afternoon eating bamboo.", "熊貓花了大部分的下午吃竹子。", "bamboo", "竹子"],
  4517: ["She refused to seek revenge after the argument.", "爭吵後，她拒絕尋求報復。", "revenge", "報復"],
  2292: ["The gardener pruned the trees before the rainy season.", "園丁在雨季前修剪了樹木。", "gardener", "園丁"],
  1414: ["A deer crossed the road just before sunrise.", "一隻鹿在日出前不久穿過馬路。", "deer", "鹿"],
  2284: ["Investing all your savings in one company is a gamble.", "把所有積蓄投資在一家公司上是一場賭注。", "gamble", "賭注"],
  4237: ["The teacher asked each pupil to explain the answer.", "老師要求每位學生解釋答案。", "pupil", "學生"],
  5951: ["This sweater is made from soft wool.", "這件毛衣是用柔軟的羊毛製成的。", "wool", "羊毛"],
  3184: ["Each lung is protected by a thin layer of tissue.", "每個肺都受到一層薄薄的組織保護。", "lung", "肺"],
  2009: ["Regular eye examinations can help protect your eyesight.", "定期眼科檢查有助於保護視力。", "eyesight", "視力"],
  4192: ["The novel is written in clear and direct prose.", "這部小說以清晰直接的散文體寫成。", "prose", "散文"],
  1395: ["A misleading advertisement can deceive consumers.", "誤導性的廣告可能欺騙消費者。", "deceive", "欺騙"],
  5578: ["The two countries signed a peace treaty after years of negotiation.", "兩國經過多年的談判後簽署了和平條約。", "treaty", "條約"],
  831: ["The sudden cancellation caused chaos at the station.", "突然取消活動在車站造成了混亂。", "chaos", "混亂"],
  442: ["The old records are stored in the basement.", "那些舊紀錄存放在地下室。", "basement", "地下室"],
  843: ["We had a brief chat while waiting for the bus.", "我們等公車時進行了簡短的聊天。", "chat", "聊天"],
  43: ["The team accomplished its goal through careful planning.", "團隊透過周密規劃達成了目標。", "accomplished", "達成"],
  1451: ["The dentist recommended a softer toothbrush for sensitive gums.", "牙醫建議敏感牙齦使用較柔軟的牙刷。", "dentist", "牙醫"],
  3185: ["Bright lights can lure insects toward the window.", "明亮的燈光可能引誘昆蟲靠近窗戶。", "lure", "引誘"],
  3222: ["The ripe mango had a sweet and fragrant flavor.", "成熟的芒果味道香甜。", "mango", "芒果"],
  862: ["The restaurant serves grilled chicken with fresh vegetables.", "那家餐廳供應烤雞肉和新鮮蔬菜。", "chicken", "雞肉"],
  870: ["Smoke rose slowly from the chimney on the roof.", "煙霧慢慢從屋頂的煙囪升起。", "chimney", "煙囪"],
  3225: ["The discovery changed humankind's understanding of the universe.", "這項發現改變了人類對宇宙的理解。", "humankind", "人類"],
  497: ["The temperature fell below zero during the night.", "夜間氣溫降到零度以下。", "below", "以下"],
  3791: ["The pilot opened the parachute after leaving the aircraft.", "飛行員離開飛機後打開了降落傘。", "parachute", "降落傘"],
  470: ["The lake's beauty attracts visitors throughout the year.", "這座湖的美景全年吸引遊客。", "beauty", "美景"],
  5730: ["Eating a variety of vegetables provides important nutrients.", "吃各種蔬菜能提供重要的營養素。", "vegetables", "蔬菜"],
  798: ["The soup contains celery, carrots, and onions.", "這道湯含有芹菜、胡蘿蔔和洋蔥。", "celery", "芹菜"],
  4668: ["We need to schedule the interview for next Monday.", "我們需要把面試安排在下週一。", "schedule", "安排"],
  5299: ["The students agreed to swap seats before the lecture began.", "講座開始前，學生同意交換座位。", "swap", "交換"],
  5622: ["The scan revealed a small tumor in the patient's lung.", "掃描結果顯示病人的肺部有一個小腫瘤。", "tumor", "腫瘤"],
  3235: ["She trained for six months before running her first marathon.", "她訓練了六個月，才參加人生第一場馬拉松。", "marathon", "馬拉松"],
  902: ["Every citizen has the right to express an opinion peacefully.", "每位公民都有和平表達意見的權利。", "citizen", "公民"],
  2355: ["Use glue to attach the label to the package.", "用膠水把標籤黏在包裹上。", "glue", "膠水"],
  3496: ["He folded the napkin and placed it beside the plate.", "他把餐巾折好，放在盤子旁邊。", "napkin", "餐巾"],
  2719: ["Her monthly income is enough to cover basic expenses.", "她每月的收入足以支付基本開銷。", "income", "收入"],
  3271: ["The mayor announced a new plan for public transportation.", "市長宣布了公共運輸的新計畫。", "mayor", "市長"],
  939: ["The clinic provides free health checks for older adults.", "這間診所為年長者提供免費健康檢查。", "clinic", "診所"],
  1003: ["The comedian used gentle humor to discuss a serious issue.", "那名喜劇演員用溫和的幽默談論嚴肅議題。", "comedian", "喜劇演員"],
  2699: ["The results imply that the treatment was effective.", "結果暗示這項治療有效。", "imply", "暗示"],
  213: ["The child regarded the kind nurse as an angel.", "那名孩子把善良的護士視為天使。", "angel", "天使"],
  3873: ["The service charges five dollars per person.", "這項服務每人收費五美元。", "per", "每"],
  3022: ["The designer revised the layout before printing the brochure.", "設計師在印刷手冊前修改了版面配置。", "layout", "版面配置"],
  3288: ["Social media can influence how people receive news.", "社群媒體可能影響人們接收新聞的方式。", "media", "媒體"],
  3880: ["The pursuit of perfection can make simple tasks stressful.", "追求完美可能讓簡單的工作變得有壓力。", "perfection", "完美"],
  3835: ["The patriot volunteered to help during the national emergency.", "那名愛國者在國家緊急狀況期間自願提供協助。", "patriot", "愛國者"],
  3233: ["The maple leaves turned bright red in autumn.", "楓樹的葉子在秋天變成鮮紅色。", "maple", "楓樹"],
  968: ["The kitchen was treated after a cockroach was found near the sink.", "水槽附近發現蟑螂後，廚房接受了除蟲處理。", "cockroach", "蟑螂"],
  4728: ["The course runs for one semester and includes a final project.", "這門課為期一學期，包含一項期末專題。", "semester", "學期"],
  5404: ["The terrorist attack led to stricter security measures.", "恐怖分子發動的攻擊導致更嚴格的安全措施。", "terrorist", "恐怖分子"],
  969: ["He ordered a nonalcoholic cocktail with dinner.", "他晚餐時點了一杯無酒精雞尾酒。", "cocktail", "雞尾酒"],
  1089: ["The report contains important information concerning public health.", "這份報告包含關於公共衛生的重要資訊。", "concerning", "關於"],
  3524: ["The nurse used a sterile needle for the injection.", "護士使用無菌針頭進行注射。", "needle", "針頭"],
  219: ["She twisted her ankle while playing basketball.", "她打籃球時扭傷了腳踝。", "ankle", "腳踝"],
  2348: ["A globe stood beside the atlas on the library shelf.", "圖書館書架上的地圖冊旁放著一個地球儀。", "globe", "地球儀"],
  2138: ["The dog was treated after the vet found a flea.", "獸醫發現跳蚤後，這隻狗接受了治療。", "flea", "跳蚤"],
  2904: ["She spread strawberry jelly on a slice of toast.", "她在一片吐司上塗了草莓果凍。", "jelly", "果凍"],
  1557: ["The director approved the final version of the film.", "導演核准了電影的最終版本。", "director", "導演"],
  3868: ["The city lies on a narrow peninsula along the coast.", "這座城市位於沿海的一座狹長半島上。", "peninsula", "半島"],
  1526: ["The truck runs on diesel rather than gasoline.", "這輛卡車使用柴油而不是汽油。", "diesel", "柴油"],
  2365: ["She waved goodbye before boarding the train.", "她上火車前揮手道別。", "goodbye", "道別"],
  3940: ["The farmer raised pigs on a small family-owned farm.", "那名農夫在一座小型家庭農場養豬。", "pigs", "豬"],
  1117: ["We called to congratulate her on the promotion.", "我們打電話祝賀她升職。", "congratulate", "祝賀"],
  567: ["The actor's bodyguard escorted him through the crowd.", "那名演員的保鑣護送他穿過人群。", "bodyguard", "保鑣"],
  5417: ["The store reported the theft to the police immediately.", "那家商店立即向警方報告了這起竊盜案。", "theft", "竊盜案"],
  3923: ["Photography allows us to preserve important memories.", "攝影讓我們能保存重要回憶。", "Photography", "攝影"],
  2165: ["Dense fog reduced visibility on the mountain road.", "濃霧降低了山路上的能見度。", "fog", "霧"],
  4002: ["The course explores how poetry expresses emotion.", "這門課探討詩如何表達情感。", "poetry", "詩"],
  1583: ["The discovery opened a new direction for medical research.", "這項發現為醫學研究開啟了新的方向。", "discovery", "發現"],
  614: ["The musician polished the brass instrument before the concert.", "音樂家在演奏會前擦亮了銅管樂器。", "brass", "銅管樂器"],
  5722: ["Water vapor rises when liquid water is heated.", "液態水受熱時會產生水蒸氣上升。", "vapor", "水蒸氣"],
  4842: ["They spent the afternoon sightseeing in the old city.", "他們整個下午都在老城區觀光。", "sightseeing", "觀光"],
  304: ["The volcano covered the village in ash.", "火山用灰燼覆蓋了村莊。", "ash", "灰燼"],
  3519: ["A passport is a necessity for international travel.", "護照是國際旅行的必需品。", "necessity", "必需品"],
  2901: ["Jealousy can damage trust in a close relationship.", "嫉妒可能破壞親密關係中的信任。", "Jealousy", "嫉妒"],
  3954: ["He ordered a pint of milk at the small café.", "他在小咖啡館點了一品脫牛奶。", "pint", "品脫"],
  3396: ["The museum combines modern design with historic architecture.", "這座博物館把現代設計與歷史建築結合在一起。", "modern", "現代"],
  1077: ["The software can compute the result in less than a second.", "這套軟體能在不到一秒內計算出結果。", "compute", "計算"],
  5885: ["Whenever I visit the town, I stop at the same bakery.", "每當我造訪那座城鎮，都會在同一家麵包店停留。", "Whenever", "每當"],
  5448: ["The stadium can hold a thousand spectators.", "這座體育場可以容納一千名觀眾。", "thousand", "一千"],
  3109: ["The lion rested in the shade after eating.", "那頭獅子吃完東西後在陰影處休息。", "lion", "獅子"],
  1934: ["Everyone attended the meeting except the director.", "除了主管之外，所有人都參加了會議。", "except", "除了"],
  229: ["The choir performed the national anthem before the game.", "合唱團在比賽前演唱了國歌。", "anthem", "國歌"],
  2393: ["She picked a bunch of grapes from the vine.", "她從葡萄藤上摘下一串葡萄。", "grapes", "葡萄"],
  2209: ["The museum displayed a fossil from the ancient sea.", "博物館展示了一塊古代海洋生物的化石。", "fossil", "化石"],
  660: ["He carried a bucket of water across the yard.", "他提著一桶水走過院子。", "bucket", "桶"],
  4409: ["The families rejoiced when the missing child returned home.", "失蹤的孩子回家時，家人們欣喜不已。", "rejoiced", "欣喜"],
  5999: ["A zebra crossed the grassland with the herd.", "一匹斑馬和獸群一起穿越草原。", "zebra", "斑馬"],
  371: ["The automobile industry is developing cleaner engines.", "汽車業正在開發更乾淨的引擎。", "automobile", "汽車"],
  3113: ["The store sells liquor only to customers of legal drinking age.", "這家商店只向達到法定飲酒年齡的顧客販售酒類。", "liquor", "酒類"],
  633: ["The bridegroom thanked the guests during the reception.", "新郎在婚宴期間向賓客道謝。", "bridegroom", "新郎"],
  4465: ["The rescue team reached the hikers before nightfall.", "救援隊在天黑前抵達登山客身邊。", "rescue", "救援"],
  1278: ["The construction crane lifted the steel beam into place.", "建築起重機把鋼樑吊到定位。", "crane", "起重機"],
  696: ["A butterfly landed on the flower beside the path.", "一隻蝴蝶停在小路旁的花朵上。", "butterfly", "蝴蝶"],
  1239: ["They rented a small cottage near the lake.", "他們在湖邊租了一間小屋。", "cottage", "小屋"],
  1683: ["The drama examines the effects of war on a family.", "這部戲劇探討戰爭對一個家庭的影響。", "drama", "戲劇"],
  5522: ["The tortoise moved slowly across the garden.", "那隻陸龜緩慢地穿過花園。", "tortoise", "陸龜"],
  4129: ["The prince visited the school during his tour.", "王子在巡訪期間參觀了那所學校。", "prince", "王子"],
  3065: ["She wrote the address down lest she forget it.", "她把地址寫下來，以免自己忘記。", "lest", "以免"],
};

const CACHE_REPLACEMENTS = {
  16: ["The meeting came to an abrupt end after the alarm sounded.", "警報響起後，會議突然結束。", "abrupt", "突然"],
  25: ["The region has abundant water during the rainy season.", "這個地區在雨季有充足的水源。", "abundant", "充足"],
  32: ["The revised proposal is acceptable to the committee.", "修訂後的提案對委員會而言是可接受的。", "acceptable", "可接受"],
  39: ["The film received widespread acclaim from critics.", "這部電影獲得評論家廣泛的好評。", "acclaim", "好評"],
  44: ["The procedure was carried out in accordance with safety rules.", "這項程序是依照安全規則執行的。", "accordance", "依照"],
  50: ["Rainwater accumulates in the valley after heavy storms.", "暴雨後，雨水會在山谷中累積。", "accumulates", "累積"],
};

const sourceIds = new Set(Object.entries(bilingual.words ?? {})
  .filter(([, records]) => records.some((record) => record.qualityScore >= 40))
  .map(([id]) => id));
for (const id of Object.keys(sourceExamples.words ?? {})) sourceIds.add(id);

const missing = vocab.filter((word) => !sourceIds.has(String(word.id)));
const rejectPatterns = [
  /\baccordance to\b/i,
  /\bthe accordance of\b/i,
  /\b(?:a|an) potential problem\b/i,
  /\bthe liquids, light, and gases absorb\b/i,
  /\bthey write them the information\b/i,
  /\bthe river accumulates water from the rain\b/i,
  /\ba loud acclaim\b/i,
];

function spanRecord(word, raw) {
  const [en, zh, targetEn, targetZh] = raw;
  const enStart = en.toLowerCase().indexOf(targetEn.toLowerCase());
  const zhStart = zh.indexOf(targetZh);
  if (enStart < 0 || zhStart < 0) throw new Error(`Target span missing for ${word.word}: ${en}`);
  return {
    en, zh, enStart, enEnd: enStart + targetEn.length, zhStart, zhEnd: zhStart + targetZh.length,
    targetEn: en.slice(enStart, enStart + targetEn.length), targetZh,
    senseZh: targetZh, pos: (word.pos.match(/[a-z]+/i)?.[0] ?? "").toLowerCase().replace(/^vt$|^vi$/, "v"),
    qualityScore: 70, origin: "ai-generated", sourceType: "ai-draft", reviewStatus: "ai-draft",
  };
}

function cacheRecord(word, record) {
  return spanRecord(word, [record.en, record.zh, record.targetEn, record.targetZh]);
}

const words = {};
for (const word of missing) {
  const id = String(word.id);
  const record = MANUAL_COMPLETIONS[word.id] ?? CACHE_REPLACEMENTS[word.id] ?? cache[id];
  if (!record) throw new Error(`No AI fallback for missing word ${word.id} ${word.word}`);
  const normalized = Array.isArray(record) ? spanRecord(word, record) : cacheRecord(word, record);
  if (rejectPatterns.some((pattern) => pattern.test(`${normalized.en} ${normalized.zh}`))) {
    throw new Error(`Rejected low-quality AI fallback ${word.id} ${word.word}: ${normalized.en}`);
  }
  words[id] = [normalized];
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  notice: "本檔案只用來補足沒有公開來源用例的詞條。所有紀錄均明確標示為本機 AI 草稿，不是 Oxford、Cambridge、Tatoeba 或 Open English Wordnet 原句，也未經人工逐句核對。",
  source: { title: "VocabFlow local AI draft", url: "", license: "No external source license", licenseUrl: "" },
  stats: { totalWords: vocab.length, wordsWithExamples: Object.keys(words).length, totalExamples: Object.values(words).flat().length, aiGeneratedExamples: Object.values(words).flat().length, sourceBackedWords: 0 },
  words,
};
fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ ...payload.stats, manualCompletions: missing.filter((word) => Array.isArray(MANUAL_COMPLETIONS[word.id])).length, outputPath }));
