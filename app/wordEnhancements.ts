export type FamilyWord = {
  id: number;
  word: string;
};

const irregularForms: Record<string, string> = {
  arise: "arise－arose－arisen",
  awake: "awake－awoke－awoken",
  be: "be－was/were－been",
  bear: "bear－bore－borne/born",
  beat: "beat－beat－beaten",
  become: "become－became－become",
  begin: "begin－began－begun",
  bend: "bend－bent－bent",
  bite: "bite－bit－bitten",
  blow: "blow－blew－blown",
  break: "break－broke－broken",
  bring: "bring－brought－brought",
  build: "build－built－built",
  buy: "buy－bought－bought",
  catch: "catch－caught－caught",
  choose: "choose－chose－chosen",
  come: "come－came－come",
  cost: "cost－cost－cost",
  cut: "cut－cut－cut",
  deal: "deal－dealt－dealt",
  dig: "dig－dug－dug",
  do: "do－did－done",
  draw: "draw－drew－drawn",
  drink: "drink－drank－drunk",
  drive: "drive－drove－driven",
  eat: "eat－ate－eaten",
  fall: "fall－fell－fallen",
  feed: "feed－fed－fed",
  feel: "feel－felt－felt",
  fight: "fight－fought－fought",
  find: "find－found－found",
  fly: "fly－flew－flown",
  forget: "forget－forgot－forgotten",
  forgive: "forgive－forgave－forgiven",
  freeze: "freeze－froze－frozen",
  get: "get－got－got/gotten",
  give: "give－gave－given",
  go: "go－went－gone",
  grow: "grow－grew－grown",
  hang: "hang－hung－hung",
  have: "have－had－had",
  hear: "hear－heard－heard",
  hide: "hide－hid－hidden",
  hit: "hit－hit－hit",
  hold: "hold－held－held",
  keep: "keep－kept－kept",
  know: "know－knew－known",
  lead: "lead－led－led",
  leave: "leave－left－left",
  lend: "lend－lent－lent",
  let: "let－let－let",
  lie: "lie－lay－lain",
  lose: "lose－lost－lost",
  make: "make－made－made",
  mean: "mean－meant－meant",
  meet: "meet－met－met",
  pay: "pay－paid－paid",
  put: "put－put－put",
  read: "read－read－read（過去式讀 /red/）",
  ride: "ride－rode－ridden",
  ring: "ring－rang－rung",
  rise: "rise－rose－risen",
  run: "run－ran－run",
  say: "say－said－said",
  see: "see－saw－seen",
  sell: "sell－sold－sold",
  send: "send－sent－sent",
  shake: "shake－shook－shaken",
  shoot: "shoot－shot－shot",
  show: "show－showed－shown",
  shut: "shut－shut－shut",
  sing: "sing－sang－sung",
  sit: "sit－sat－sat",
  sleep: "sleep－slept－slept",
  speak: "speak－spoke－spoken",
  spend: "spend－spent－spent",
  stand: "stand－stood－stood",
  steal: "steal－stole－stolen",
  swim: "swim－swam－swum",
  take: "take－took－taken",
  teach: "teach－taught－taught",
  tell: "tell－told－told",
  think: "think－thought－thought",
  throw: "throw－threw－thrown",
  understand: "understand－understood－understood",
  wake: "wake－woke－woken",
  wear: "wear－wore－worn",
  win: "win－won－won",
  write: "write－wrote－written",
};

function normalizedWord(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z]+$/.test(normalized) ? normalized : "";
}

function generatedFamilyForms(base: string) {
  const forms = new Set<string>();
  if (base.length < 3) return forms;

  ["s", "es", "ed", "ing", "er", "est", "ly", "ness", "ment", "ful", "less", "able", "al", "ive", "ity", "tion", "ation"].forEach((suffix) => forms.add(`${base}${suffix}`));

  if (base.endsWith("e") && base.length > 3) {
    const stem = base.slice(0, -1);
    ["ing", "ion", "ive", "able", "ation"].forEach((suffix) => forms.add(`${stem}${suffix}`));
  }

  if (base.endsWith("y") && base.length > 3) {
    const stem = base.slice(0, -1);
    ["ies", "ied", "ier", "iest", "ily", "iness", "ical"].forEach((suffix) => forms.add(`${stem}${suffix}`));
  }

  return forms;
}

export function buildWordFamilyMap(words: FamilyWord[]) {
  const byNormalized = new Map<string, FamilyWord>();
  const related = new Map<number, Set<string>>();

  for (const word of words) {
    const normalized = normalizedWord(word.word);
    if (normalized) byNormalized.set(normalized, word);
  }

  for (const word of words) {
    const base = normalizedWord(word.word);
    if (!base) continue;
    for (const form of generatedFamilyForms(base)) {
      const match = byNormalized.get(form);
      if (!match || match.id === word.id) continue;
      if (!related.has(word.id)) related.set(word.id, new Set());
      if (!related.has(match.id)) related.set(match.id, new Set());
      related.get(word.id)?.add(match.word);
      related.get(match.id)?.add(word.word);
    }
  }

  return new Map(Array.from(related, ([id, family]) => [id, Array.from(family).sort()]));
}

export function irregularFormFor(word: string) {
  return irregularForms[normalizedWord(word)] ?? "";
}
