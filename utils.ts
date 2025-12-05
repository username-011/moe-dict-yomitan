export function unsandhifyZhuyin(term: string, originalReading: string) {
  // \uff0c = ，
  term = term.replace(/\uff0c/g, "");
  originalReading = originalReading
    .replaceAll(" ", "\u3000")
    .replace(/\u3000*\uff0c\u3000*/g, "\u3000");
  const yi = Array.from(term.matchAll(/一/g));
  const bu = Array.from(term.matchAll(/不/g));
  let reading = originalReading.split("\u3000");
  if (yi.length > 0) yi.forEach((match) => (reading[match.index] = "ㄧ"));
  if (bu.length > 0) bu.forEach((match) => (reading[match.index] = "ㄅㄨˋ"));
  return reading.join("");
}

// ah, all libraries for pinyin splitting are kind of broken in one way or another
// why bother? I don't care enough for the pinyin.
// export function unsandhifyPinyin(term: string, originalReading: string) {
//   const yi = Array.from(term.matchAll(/一/g));
//   const bu = Array.from(term.matchAll(/不/g));
//   let reading = splitPinyinSyllables(originalReading);
//   if (yi.length > 0) yi.forEach((match) => (reading[match.index] = "yī"));
//   if (bu.length > 0) bu.forEach((match) => (reading[match.index] = "bù"));
//   return reading.join(" ");
// }
