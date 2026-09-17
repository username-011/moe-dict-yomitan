import type { StructuredContentNode } from "yomichan-dict-builder/dist/types/yomitan/termbank";

/** A reading expressed in both systems. Either side may be missing. */
export type SystemReadings = { zhuyin?: string; pinyin?: string };

/**
 * One span per available reading system, each tagged with `readingTag` (rendered as `data-sc-reading-tag`).
 *
 * Both editions of a dictionary get exactly the same content; the pinyin edition hides
 * `[data-sc-reading-tag="zhuyin"]` through its styles.css and vice versa. Keeping the content
 * byte-identical between editions lets downstream tools merge the two editions into one entry
 * with both readings, and pick the system to display themselves.
 */
export function readingSpans(
  readings: SystemReadings,
  moedictType: string,
): StructuredContentNode[] {
  const spans: StructuredContentNode[] = [];
  if (readings.zhuyin)
    spans.push({
      tag: "span",
      content: readings.zhuyin,
      data: { moedict: moedictType, readingTag: "zhuyin" },
    });
  if (readings.pinyin)
    spans.push({
      tag: "span",
      content: readings.pinyin,
      data: { moedict: moedictType, readingTag: "pinyin" },
    });
  return spans;
}

export function hasReading(readings: SystemReadings | undefined): readings is SystemReadings {
  return !!readings && (!!readings.zhuyin || !!readings.pinyin);
}

/** CSS appended to styles.css for one edition: hides the other reading system inside content. */
export function hideOtherReadingSystemCss(edition: "pinyin" | "zhuyin"): string {
  const other = edition === "pinyin" ? "zhuyin" : "pinyin";
  return `\n/* ${edition} edition: content carries both systems, hide the other one */\n[data-sc-reading-tag="${other}"] {\n  display: none;\n}\n`;
}
