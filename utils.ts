import { findSyllableBoundaries } from "pinyin-tone-tool";

const splitPinyinSyllables = (s: string) =>
  findSyllableBoundaries(s).map((b) => s.slice(b.start, b.end));

export function parsePinyin(s: string) {
  if (s.match(/huěr/g)) {
    return splitPinyinSyllables(s.replaceAll("huěr", "huǐr"))
      .join(" ")
      .replaceAll("huǐr", "huěr");
  }
  return splitPinyinSyllables(s).join(" ");
}
