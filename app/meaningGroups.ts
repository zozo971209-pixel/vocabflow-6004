export type MeaningGroup = {
  key: string;
  abbreviation: string;
  label: string;
  sourceField?: string;
  primary: string[];
  secondary: string[];
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

function splitSenses(value: string) {
  return value
    .split(/[，,；;]+/)
    .map((sense) => sense.trim())
    .filter(Boolean);
}

export function parseMeaningGroups(meaning: string, fallbackPos = ""): MeaningGroup[] {
  const groups: MeaningGroup[] = [];
  let current: MeaningGroup | undefined;
  const fallbackAbbreviation = fallbackPos.match(/vt|vi|v|n|adj|adv|prep|pron|conj|art|num|aux|interj/i)?.[0].toLowerCase();

  const ensureGeneralGroup = () => {
    if (!current) {
      current = {
        key: `general-${groups.length}`,
        abbreviation: "",
        label: "一般用法",
        primary: [],
        secondary: [],
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
            abbreviation: fallbackAbbreviation ? `${fallbackAbbreviation}.` : "",
            label: fallbackAbbreviation ? (POS_LABELS[fallbackAbbreviation] ?? fallbackAbbreviation) : "一般用法",
            sourceField: field,
            primary: senses.slice(0, 2),
            secondary: senses.slice(2),
            supplements: [],
          };
          groups.push(current);
        } else {
          ensureGeneralGroup().supplements.push({ field, senses });
        }
        return;
      }

      const posMatch = line.match(/^(vt|vi|v|n|a|ad|adj|adv|prep|pron|conj|art|num|aux|int|interj)\.\s*(.*)$/i);
      const abbreviation = posMatch?.[1].toLowerCase();
      const senses = splitSenses(posMatch?.[2] ?? line);
      if (!senses.length) return;

      current = {
        key: `${abbreviation ?? "general"}-${groups.length}`,
        abbreviation: abbreviation ? `${abbreviation}.` : "",
        label: abbreviation ? (POS_LABELS[abbreviation] ?? abbreviation) : "一般用法",
        primary: senses.slice(0, 2),
        secondary: senses.slice(2),
        supplements: [],
      };
      groups.push(current);
    });

  return groups;
}
