export type MeaningGroup = {
  key: string;
  abbreviation: string;
  label: string;
  sourceField?: string;
  senses: string[];
  supplements: { field: string; senses: string[] }[];
};

const POS_LABELS: Record<string, string> = {
  n: "名詞",
  v: "動詞",
  vt: "及物動詞",
  vi: "不及物動詞",
  a: "形容詞",
  adj: "形容詞",
  ad: "副詞",
  adv: "副詞",
  prep: "介系詞",
  pron: "代名詞",
  conj: "連接詞",
  art: "冠詞",
  num: "數詞",
  aux: "助動詞",
  int: "感嘆詞",
  interj: "感嘆詞",
};

const POS_NAME_PATTERN = "vt|vi|adj|adv|prep|pron|conj|art|num|aux|interj|int|ad|v|n|a";
const POS_TOKEN_PATTERN = `\\(?(?:${POS_NAME_PATTERN})\\.\\)?`;
const POS_SEQUENCE_PATTERN = new RegExp(`^(${POS_TOKEN_PATTERN}(?:\\s*\\/\\s*${POS_TOKEN_PATTERN})*)\\s*(.*)$`, "i");

function parsePosSequence(value: string) {
  const keys = [...value.matchAll(new RegExp(POS_NAME_PATTERN, "gi"))].map((match) => match[0].toLowerCase());
  if (!keys.length) return undefined;
  return {
    abbreviation: keys.map((key) => `${key}.`).join("/"),
    label: [...new Set(keys.map((key) => POS_LABELS[key] ?? key))].join("／"),
  };
}

function splitSenses(value: string) {
  return value
    .split(/[，,；;]+/)
    .map((sense) => sense.trim())
    .filter(Boolean);
}

export function parseMeaningGroups(meaning: string, fallbackPos = ""): MeaningGroup[] {
  const groups: MeaningGroup[] = [];
  let current: MeaningGroup | undefined;
  const fallback = parsePosSequence(fallbackPos);

  const ensureGeneralGroup = () => {
    if (!current) {
      current = {
        key: `general-${groups.length}`,
        abbreviation: "",
        label: "一般用法",
        senses: [],
        supplements: [],
      };
      groups.push(current);
    }
    return current;
  };

  meaning
    .replace(/\\r\\n|\\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const fieldMatch = line.match(/^\[([^\]]+)]\s*(.*)$/);
      if (fieldMatch) {
        const [, field, text] = fieldMatch;
        const senses = splitSenses(text);
        if (!current) {
          current = {
            key: `field-${groups.length}`,
            abbreviation: fallback?.abbreviation ?? "",
            label: fallback?.label ?? "一般用法",
            sourceField: field,
            senses,
            supplements: [],
          };
          groups.push(current);
        } else {
          ensureGeneralGroup().supplements.push({ field, senses });
        }
        return;
      }

      const posMatch = line.match(POS_SEQUENCE_PATTERN);
      const pos = posMatch ? parsePosSequence(posMatch[1]) : undefined;
      const senses = splitSenses(posMatch?.[2] ?? line);
      if (!senses.length) return;

      current = {
        key: `${pos?.abbreviation.replace(/[^a-z]/gi, "-") ?? "general"}-${groups.length}`,
        abbreviation: pos?.abbreviation ?? "",
        label: pos?.label ?? "一般用法",
        senses,
        supplements: [],
      };
      groups.push(current);
    });

  return groups;
}
