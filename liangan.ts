import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import { Dictionary, TermEntry } from "yomichan-dict-builder";
import parse_html from "./parse_html.ts";
import type {
  StructuredContent,
  StructuredContentNode,
} from "yomichan-dict-builder/dist/types/yomitan/termbank";
import { parsePinyin, unresolvedPinyin } from "./utils.ts";
import { hasReading, readingSpans, type SystemReadings } from "./readings.ts";

const someLiangAnEntry = {
  稿件版本: "1",
  稿件階段: "終定稿",
  稿件狀態: "",
  備注: "",
  字詞流水序: "1000010119",
  正體字形: "一石兩鳥",
  簡化字形: "一石两鸟",
  音序: "",
  "臺／陸特有詞": "",
  "臺／陸特有音": "",
  臺灣音讀: "丨ˋ　ㄕˊ　ㄌ丨ㄤˇ　ㄋ丨ㄠˇ",
  臺灣漢拼: "yìshí-liǎnɡniǎo",
  大陸音讀: "丨　ㄕˊ　ㄌ丨ㄤˇ　ㄋ丨ㄠˇ",
  大陸漢拼: "yīshí-liǎnɡniǎo",
};
type NumericRange<
  START extends number,
  END extends number,
  ARR extends unknown[] = [],
  ACC extends number = never
> = ARR["length"] extends END
  ? ACC | START | END
  : NumericRange<
      START,
      END,
      [...ARR, 1],
      ARR[START] extends undefined ? ACC : ACC | ARR["length"]
    >;
type Meanings = `釋義${NumericRange<1, 30>}`;

type LiangAnEntry = Record<string, string | undefined> &
  typeof someLiangAnEntry & {
    [K in Meanings]?: string;
  };

// Pinyin cells that are truncated or garbled in the sheet itself. The zhuyin cell of the same row is intact,
// so they are corrected from it. (All of them show up in the "disagree with the zhuyin cell" report of the build.)
const PINYIN_TYPOS: Record<string, string> = {
  "wánní-fēngguā": "wánní-fēngguān", // 丸泥封關 ㄍㄨㄢ
  "chúguānxī": "chúguāngxī", // 儲光羲 ㄍㄨㄤ
  "hòutǔniángniɑg": "hòutǔniángniang", // 后土娘娘 ˙ㄋㄧㄤ
  "hūniú-hūm": "hūniú-hūmǎ", // 呼牛呼馬 ㄇㄚˇ
  "wécí": "wéicí", // 微辭 ㄨㄟˊ
  "uānpí-chūyǔ": "zuānpí-chūyǔ", // 鑽皮出羽 ㄗㄨㄢ
  "jīnjiùyuàn diào mǎshǒuzhēn wén bìngxù": "jīngjiùyuàn diào mǎshǒuzhēn wén bìngxù", // 經舊苑弔馬守貞文並序 ㄐㄧㄥ
  "qiānr-bābǎ": "qiānr-bābǎi", // 千兒八百 (大陸) ㄅㄞˇ
  "mùyǔ-zhìfēn": "mùyǔ-zhìfēng", // 沐雨櫛風 (大陸) ㄈㄥ
};

function getContent(contentRow: string, term: string): StructuredContentNode {
  let note: StructuredContentNode = "";
  const noteMatch = contentRow.match(/[∥‖](.*)$/);
  if (noteMatch) {
    const [fullMatch, content] = noteMatch;
    note = {
      tag: "span",
      content,
      data: { moedict: "definition-entry-note" },
    };
    contentRow = contentRow.replace(fullMatch, "").trim();
  }
  let content: StructuredContentNode =
    contentRow.match(/(^.*?(?=(\[例\])))|(^.*(?!(\[例\])))/g)?.at(0) ?? "";
  const pos = contentRow.match(/^\d\..*(?=：$)/g);
  if (pos && pos.length === 1) {
    const [posLabel] = pos;
    content = [
      {
        tag: "span",
        content: [posLabel, { tag: "br" }],
        data: { moedict: "pos-label" },
      },
    ] satisfies StructuredContentNode;
  }
  const example = contentRow.match(/(?<=\[例\]).*/g)?.at(0);
  return {
    tag: "div",
    content: [
      {
        tag: "span",
        content: content,
        data: { moedict: "definition-entry-content" },
      },
      note,
      example
        ? {
            tag: "span",
            content: [
              {
                tag: "span",
                content: "例",
                data: { moedict: "definition-entry-example-label" },
              },
              {
                tag: "span",
                content: example.replace(/[〜～]/g, term),
                data: { moedict: "definition-entry-example-content" },
              },
            ],
            data: { moedict: "definition-entry-example-parent" },
          }
        : "",
    ],
    data: { moedict: "definition-entry" },
  };
}

function getAdditionalInfo(
  mainlandReading?: SystemReadings,
  taiwanOrChinaTerm?: string,
  taiwanOrChinaReading?: string
): StructuredContentNode[] {
  const info = [] as StructuredContentNode[];
  hasReading(mainlandReading) &&
    info.push({
      tag: "span",
      content: [
        {
          tag: "span",
          content: "大陸音讀",
          data: { moedict: "mainland-reading-label" },
        },
        ...readingSpans(mainlandReading, "mainland-reading-content"),
      ],
      data: { moedict: "mainland-reading-parent", altReadingType: "大陸音讀" },
    });
  taiwanOrChinaTerm &&
    info.push({
      tag: "span",
      content: [
        {
          tag: "span",
          content: `詞`,
          data: { moedict: "word-belong-label" },
        },
        {
          tag: "span",
          content: taiwanOrChinaTerm,
          data: { moedict: "word-belong-content" },
        },
      ],
      data: { moedict: "word-belong-parent" },
    });
  taiwanOrChinaReading &&
    info.push({
      tag: "span",
      content: [
        {
          tag: "span",
          content: `音`,
          data: { moedict: "sound-belong-label" },
        },
        {
          tag: "span",
          content: taiwanOrChinaReading,
          data: { moedict: "sound-belong-content" },
        },
      ],
      data: { moedict: "sound-belong-parent" },
    });
  return info;
}

export async function addTermsLiangAn(
  [liangAnDicZhuyin, liangAnDicPinyin]: [Dictionary, Dictionary],
  path: string,
  popularityBoost = 100
) {
  const fbLiangAn = readFileSync(path);
  const workbookLiangAn = read(fbLiangAn);
  const sheetLiangAn = workbookLiangAn.Sheets[workbookLiangAn.SheetNames[0]!]!;
  const dataLiangAn = utils.sheet_to_json(sheetLiangAn) as LiangAnEntry[];

  let b = 0;
  // One sequence number per source entry, shared by its traditional/simplified rows and
  // identical in both editions, so that consumers can group the rows back together.
  let sequence = 0;
  for (const entry of dataLiangAn) {
    // The zhuyin cells still have their per-syllable spacing at this point (the loop below strips it for the
    // zhuyin edition's readings); parsePinyin uses that spacing to check where the joined pinyin has to be cut.
    const zhuyinAsTyped = { 臺灣漢拼: entry.臺灣音讀, 大陸漢拼: entry.大陸音讀 };
    // preprocess a little bit
    for (const key in entry) {
      if (typeof entry[key] === "string") {
        entry[key] = entry[key].replaceAll("ɡ", "g").trim();
      }
      // some keys have "丨" in them (supposed to be used in vertical text, but we use horizontal text)
      if (["臺灣音讀", "大陸音讀"].includes(key) || key.startsWith("釋義")) {
        entry[key] = (entry[key] ?? "").replaceAll("丨", "ㄧ");
        if (["臺灣音讀", "大陸音讀"].includes(key))
          entry[key] = entry[key].replace(/[ 　，]/g, "") ?? "";
      } else if (key === "臺灣漢拼" || key === "大陸漢拼") {
        const cell = entry[key] ?? "";
        entry[key] = parsePinyin(PINYIN_TYPOS[cell] ?? cell, zhuyinAsTyped[key]);
      }
    }

    const {
      正體字形: termTrad,
      簡化字形: termSimpl,
      臺灣音讀: zhuyinReading,
      臺灣漢拼: pinyinReading,
      大陸音讀: mZhuyinReading,
      大陸漢拼: mPinyinReading,
      // star is Mainland, triangle is Taiwan
      "臺／陸特有詞": taiwanOrChinaTerm,
      "臺／陸特有音": taiwanOrChinaReading,
      音序: order,
    } = entry;
    // the sheet leaves 簡化字形 empty when it equals 正體字形
    const hasDistinctSimplified = !!termSimpl && termTrad !== termSimpl;
    const termsParent: StructuredContentNode = {
      tag: "span",
      content: [],
      data: { moedict: "terms-parent" },
    };
    (termsParent.content as StructuredContentNode[]).push({
      tag: "span",
      content: `${termTrad}`,
      data: { moedict: "traditional-term" },
    });
    if (hasDistinctSimplified)
      (termsParent.content as StructuredContentNode[]).push({
        tag: "span",
        content: `${termSimpl}`,
        data: { moedict: "simplified-term" },
        lang: "zh-CN",
      });
    const meaningsParent = {
      tag: "div",
      content: [] as StructuredContentNode[],
      data: { moedict: "meanings-parent" },
    } satisfies StructuredContentNode;
    for (let i = 1; i <= 30; i++) {
      const meaning = entry[`釋義${i}`] as string | undefined;
      if (meaning) {
        meaning.includes("<table")
          ? meaningsParent.content.push(parse_html(meaning))
          : meaningsParent.content.push(getContent(meaning, termTrad));
      } else {
        break;
      }
    }
    // The mainland reading block is shown when it differs in either system, and then carries
    // both systems, so the content is identical in the zhuyin and pinyin editions.
    const mainlandDiffers =
      (!!mZhuyinReading && mZhuyinReading !== zhuyinReading) ||
      (!!mPinyinReading && mPinyinReading !== pinyinReading);
    const content: StructuredContent = [
      {
        tag: "span",
        content: [
          termsParent,
          getAdditionalInfo(
            mainlandDiffers
              ? { zhuyin: mZhuyinReading, pinyin: mPinyinReading }
              : undefined,
            taiwanOrChinaTerm,
            taiwanOrChinaReading
          ),
        ],
        data: { moedict: "first-row-parent" },
      },
      meaningsParent,
    ];
    const entrySequence = ++sequence;
    const zhuyinTermEntry = new TermEntry(termTrad)
      .setReading(zhuyinReading)
      .setSequenceNumber(entrySequence)
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition({
        type: "structured-content",
        content: { tag: "span", content, lang: "zh-TW" },
      });
    const pinyinTermEntry = new TermEntry(termTrad)
      .setReading(pinyinReading ?? "")
      .setSequenceNumber(entrySequence)
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition({
        type: "structured-content",
        content: { tag: "span", content, lang: "zh-TW" },
      });
    await Promise.all([
      liangAnDicZhuyin.addTerm(zhuyinTermEntry.build()),
      liangAnDicPinyin.addTerm(pinyinTermEntry.build()),
    ]);
    if (hasDistinctSimplified) {
      zhuyinTermEntry.setTerm(termSimpl);
      pinyinTermEntry.setTerm(termSimpl);
      await Promise.all([
        liangAnDicZhuyin.addTerm(zhuyinTermEntry.build()),
        liangAnDicPinyin.addTerm(pinyinTermEntry.build()),
      ]);
    }
    if (++b % 10000 === 0) {
      console.log(`Processed ${b} entries`);
    }
  }
  if (unresolvedPinyin.length)
    console.log(
      `${unresolvedPinyin.length} pinyin cells disagree with the zhuyin cell of their row (typos in the sheet):\n  ` +
        unresolvedPinyin.join("\n  ")
    );
}
