/**
 * Helpers around pinyin-tone-tool for the 兩岸詞典 pinyin columns.
 *
 * The sheet stores Hanyu Pinyin joined ("yìshí-liǎnɡniǎo", "wùniè", "fǎn’ér"); pinyin-tone-tool cuts it into
 * syllables. Two things go wrong if its output is used as is:
 *
 *   - it only keeps what it recognises, so anything else disappears without a trace. The sheet types a
 *     toneless a as ɑ (U+0251), which cost every neutral-tone -a syllable (媽媽 "mā", 嗎 "");
 *   - some cuts cannot be right: "hérú" -> "hér ú" (何如), and rows where the sheet forgot the apostrophe
 *     (南歐 "nánōu", 陳子昂 "chénzǐánɡ") or has a stray space ("wùj iānɡshān").
 *
 * So the input is normalised first, and the result is compared with the zhuyin cell of the same row, which
 * has explicit per-syllable spacing. When both cells spell the same letters, the zhuyin spacing decides where
 * the cuts go; when they do not, the row is reported instead of being silently wrong.
 */

const TONE_MARKS: Record<string, string> = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", ü: "ǖǘǚǜ" };
const TONED_TO_BASE = new Map<string, [base: string, tone: number]>();
for (const [base, marks] of Object.entries(TONE_MARKS))
  [...marks].forEach((m, i) => TONED_TO_BASE.set(m, [base, i + 1]));

const VOWELS = new Set([..."aeiouüê", ...TONED_TO_BASE.keys()]);

/**
 * The sheet is typeset the mainland way: script ɡ (U+0261) for g and - for a toneless a only - ɑ (U+0251).
 * Anything that does not know ɑ is a vowel loses every neutral-tone -a syllable (媽媽 māmɑ, 早上 zǎoshɑng).
 * The breves are typos for carons (做臉 "zuòliăn").
 */
const LOOKALIKES: Record<string, string> = { ɡ: "g", ɑ: "a", ă: "ǎ", ĕ: "ě", ĭ: "ǐ", ŏ: "ǒ", ŭ: "ǔ" };
const SEPARATORS = /[\s\-–—－,，、;；·‧・'’‘`/]+/u;

/** Call this BEFORE handing a cell to pinyin-tone-tool. */
export const normalizePinyin = (raw: string) =>
  [...raw.normalize("NFC")].map((c) => LOOKALIKES[c] ?? c).join("").trim();

const stripTones = (s: string) =>
  [...s.toLowerCase()].map((c) => TONED_TO_BASE.get(c)?.[0] ?? c).join("");

// ---------------------------------------------------------------------------------------------
// zhuyin -> toneless pinyin, only used to cross-check / place syllable boundaries

const ZHUYIN_INITIALS: Record<string, string> = {
  ㄅ: "b", ㄆ: "p", ㄇ: "m", ㄈ: "f", ㄉ: "d", ㄊ: "t", ㄋ: "n", ㄌ: "l", ㄍ: "g", ㄎ: "k", ㄏ: "h",
  ㄐ: "j", ㄑ: "q", ㄒ: "x", ㄓ: "zh", ㄔ: "ch", ㄕ: "sh", ㄖ: "r", ㄗ: "z", ㄘ: "c", ㄙ: "s",
};
const ZHUYIN_FINALS: Record<string, string> = {
  ㄚ: "a", ㄛ: "o", ㄜ: "e", ㄝ: "ê", ㄞ: "ai", ㄟ: "ei", ㄠ: "ao", ㄡ: "ou", ㄢ: "an", ㄣ: "en", ㄤ: "ang", ㄥ: "eng", ㄦ: "er",
};
// spelling of medial + final, without an initial (yi, wu, yu ...) and after one (-i-, -u-, -ü-)
const NO_INITIAL: Record<string, Record<string, string>> = {
  ㄧ: { "": "yi", a: "ya", o: "yo", ê: "ye", ai: "yai", ao: "yao", ou: "you", an: "yan", en: "yin", ang: "yang", eng: "ying" },
  ㄨ: { "": "wu", a: "wa", o: "wo", ai: "wai", ei: "wei", an: "wan", en: "wen", ang: "wang", eng: "weng" },
  ㄩ: { "": "yu", ê: "yue", an: "yuan", en: "yun", eng: "yong" },
};
const AFTER_INITIAL: Record<string, Record<string, string>> = {
  ㄧ: { "": "i", a: "ia", o: "io", ê: "ie", ai: "iai", ao: "iao", ou: "iu", an: "ian", en: "in", ang: "iang", eng: "ing" },
  ㄨ: { "": "u", a: "ua", o: "uo", ai: "uai", ei: "ui", an: "uan", en: "un", ang: "uang", eng: "ong" },
  ㄩ: { "": "ü", ê: "üe", an: "üan", en: "ün", eng: "iong" },
};
const ZHUYIN_VARIANTS: Record<string, string> = { "丨": "ㄧ", "｜": "ㄧ", "〡": "ㄧ" };

/** One zhuyin syllable -> toneless pinyin ("huar" style for erhua), or undefined if it is not standard zhuyin. */
function zhuyinSyllableToPinyin(syllable: string): string | undefined {
  let z = [...syllable].map((c) => ZHUYIN_VARIANTS[c] ?? c).join("").replace(/[ˊˇˋ˙‵′•‧·]/gu, "");
  let erhua = "";
  if (z.length > 1 && z.endsWith("ㄦ")) {
    erhua = "r";
    z = z.slice(0, -1);
  }
  let initial = "";
  if (z[0] !== undefined && z[0] in ZHUYIN_INITIALS) {
    initial = ZHUYIN_INITIALS[z[0]]!;
    z = z.slice(1);
  }
  let medial = "";
  if (z[0] !== undefined && z[0] in NO_INITIAL) {
    medial = z[0];
    z = z.slice(1);
  }
  let final = "";
  if (z) {
    const f = ZHUYIN_FINALS[z];
    if (f === undefined) return undefined;
    final = f;
  }
  let pinyin: string | undefined;
  if (!initial) {
    pinyin = medial ? NO_INITIAL[medial]![final] : final;
  } else {
    let rest: string | undefined;
    if (medial) {
      rest = AFTER_INITIAL[medial]![final];
      if (rest !== undefined && medial === "ㄩ" && "jqx".includes(initial) && rest !== "iong") rest = rest.replace("ü", "u");
    } else rest = final || (["zh", "ch", "sh", "r", "z", "c", "s"].includes(initial) ? "i" : "");
    pinyin = rest === undefined ? undefined : initial + rest;
  }
  if (!pinyin) return undefined;
  return (pinyin === "ê" ? pinyin : pinyin.replace("ê", "e")) + erhua;
}

/** Expected toneless syllables; an entry is undefined where the zhuyin is non-standard (ㄏㄨㄜˇㄦ ...). */
function zhuyinToSyllables(zhuyin: string): (string | undefined)[] {
  return zhuyin
    .replace(/[\uE000-\uF8FF]/gu, "") // private-use glyphs left over in a few cells
    .split(/[\s，,﹐、；;。]+/u)
    .filter(Boolean)
    .map(zhuyinSyllableToPinyin);
}

// ---------------------------------------------------------------------------------------------

/** Moves a tone mark that sits on the wrong vowel (the sheet has "shìdɑì", "toú", "hùi", "ɡǔo"). */
function fixToneMarkPlacement(syllable: string): string {
  const marked = [...syllable].filter((c) => TONED_TO_BASE.has(c));
  if (marked.length !== 1) return syllable;
  const tone = TONED_TO_BASE.get(marked[0]!)![1];
  const base = [...syllable].map((c) => TONED_TO_BASE.get(c)?.[0] ?? c);
  const plain = base.join("");
  // a and e always take the mark, then the o of "ou", otherwise the last vowel
  let at = plain.search(/[ae]/u);
  if (at < 0) at = plain.indexOf("ou");
  if (at < 0) at = Math.max(...[..."iouü"].map((v) => plain.lastIndexOf(v)));
  if (at < 0) return syllable;
  base[at] = TONE_MARKS[base[at]!]![tone - 1]!;
  return base.join("");
}

export type SplitStatus =
  | "empty" // nothing pronounceable in the cell
  | "unchecked" // no zhuyin to compare with
  | "agree" // the library's split and the zhuyin column agree
  | "guided" // same letters as the zhuyin, but the library cut them differently: zhuyin spacing wins
  | "unresolved"; // the cells spell different things, or letters got lost and the zhuyin cannot settle it

/**
 * @param pinyin the NORMALISED pinyin cell (see normalizePinyin)
 * @param split what pinyin-tone-tool made of it
 * @param zhuyin the zhuyin cell of the same row, WITH its original spacing (optional)
 */
export function alignWithZhuyin(pinyin: string, split: string[], zhuyin?: string): { syllables: string[]; status: SplitStatus } {
  const done = (syllables: string[], status: SplitStatus) => ({ syllables: syllables.map(fixToneMarkPlacement), status });
  const letters = pinyin.split(SEPARATORS).join("");
  if (![...letters.toLowerCase()].some((c) => VOWELS.has(c))) return done([], "empty");
  const lostLetters = stripTones(split.join("")) !== stripTones(letters);
  const expected = zhuyin ? zhuyinToSyllables(zhuyin) : [];
  if (!expected.length) return done(split, lostLetters ? "unresolved" : "unchecked");
  if (!lostLetters && expected.length === split.length && expected.every((e, i) => e === undefined || e === stripTones(split[i]!)))
    return done(split, "agree");
  if (!expected.includes(undefined) && stripTones(letters) === expected.join("")) {
    let at = 0;
    return done(expected.map((e) => letters.slice(at, (at += e!.length))), "guided");
  }
  return done(split, "unresolved");
}
