import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import { Dictionary, TermEntry } from "yomichan-dict-builder";
import parse_html from "./parse_html.ts";
import type {
  StructuredContent,
  StructuredContentNode,
} from "yomichan-dict-builder/dist/types/yomitan/termbank";

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

function getContent(contentRow: string, term: string): StructuredContentNode {
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
  altReading?: string,
  taiwanOrChinaTerm?: string,
  taiwanOrChinaReading?: string
): StructuredContentNode[] {
  const info = [] as StructuredContentNode[];
  altReading &&
    info.push({
      tag: "span",
      content: [
        {
          tag: "span",
          content: "大陸音讀",
          data: { moedict: "mainland-reading-label" },
        },
        {
          tag: "span",
          content: altReading,
          data: { moedict: "mainland-reading-content" },
        },
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
  for (const entry of dataLiangAn) {
    // preprocess a little bit
    for (const key in entry) {
      // some keys have "丨" in them (supposed to be used in vertical text, but we use horizontal text)
      if (["臺灣音讀", "大陸音讀"].includes(key) || key.startsWith("釋義")) {
        entry[key] = (entry[key] ?? "").replaceAll("丨", "ㄧ");
        if (["臺灣音讀", "大陸音讀"].includes(key))
          entry[key] = entry[key].replace(/[ \u3000\uff0c]/g, "") ?? "";
      } else if (["臺灣漢拼", "大陸漢拼"].includes(key)) {
        entry[key] = entry[key]
          ?.trim()
          ?.replaceAll("\u0261", "g")
          .replace(/[-,]/g, " ");
      }
      // not all keys have trimming so maybe apply it just in case
      if (typeof entry[key] === "string") {
        entry[key] = entry[key].trim();
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
    if (!!termSimpl && termTrad !== termSimpl)
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
    const contentZhuyin: StructuredContent = [
      {
        tag: "span",
        content: [
          termsParent,
          getAdditionalInfo(
            mZhuyinReading && mZhuyinReading !== zhuyinReading
              ? mZhuyinReading
              : undefined,
            taiwanOrChinaTerm,
            taiwanOrChinaReading
          ),
        ],
        data: { moedict: "first-row-parent" },
      },
      meaningsParent,
    ];
    const contentPinyin: StructuredContent = [
      {
        tag: "span",
        content: [
          termsParent,
          getAdditionalInfo(
            mPinyinReading && mPinyinReading !== pinyinReading
              ? mPinyinReading
              : undefined,
            taiwanOrChinaTerm,
            taiwanOrChinaReading
          ),
        ],
        data: { moedict: "first-row-parent" },
      },
      meaningsParent,
    ];
    const zhuyinTermEntry = new TermEntry(termTrad)
      .setReading(zhuyinReading)
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition({
        type: "structured-content",
        content: { tag: "span", content: contentZhuyin, lang: "zh-TW" },
      });
    const pinyinTermEntry = new TermEntry(termTrad)
      .setReading(pinyinReading ?? "")
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition({
        type: "structured-content",
        content: { tag: "span", content: contentPinyin, lang: "zh-TW" },
      });
    await Promise.all([
      liangAnDicZhuyin.addTerm(zhuyinTermEntry.build()),
      liangAnDicPinyin.addTerm(pinyinTermEntry.build()),
    ]);
    if (termTrad !== termSimpl) {
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
}
