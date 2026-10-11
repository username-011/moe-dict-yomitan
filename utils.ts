import { findSyllableBoundaries } from "pinyin-tone-tool";
import { alignWithZhuyin, normalizePinyin } from "./pinyin.ts";

const splitPinyinSyllables = (s: string) =>
  findSyllableBoundaries(s).map((b) => s.slice(b.start, b.end));

function splitWithLibrary(s: string) {
  if (s.match(/huěr/g)) {
    return splitPinyinSyllables(s.replaceAll("huěr", "huǐr")).map((syllable) =>
      syllable.replaceAll("huǐr", "huěr")
    );
  }
  return splitPinyinSyllables(s);
}

/** Pinyin cells the library could not split cleanly and the zhuyin cell of the row could not settle either. */
export const unresolvedPinyin: string[] = [];

/**
 * "yìshí-liǎnɡniǎo" -> "yì shí liǎng niǎo"
 * @param zhuyin the zhuyin cell of the same row WITH its original spacing; used to check (and if needed place) the syllable boundaries
 */
export function parsePinyin(raw: string, zhuyin?: string) {
  const s = normalizePinyin(raw).replace(/[-,]/g, " ");
  const { syllables, status } = alignWithZhuyin(s, splitWithLibrary(s), zhuyin);
  if (status === "unresolved") unresolvedPinyin.push(`${raw}  /  ${zhuyin}`);
  return syllables.join(" ");
}
