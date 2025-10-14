import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import { Dictionary, TermEntry } from "yomichan-dict-builder";

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

export async function addTermsLiangAn(
  [liangAnDicZhuyin, liangAnDicPinyin]: [Dictionary, Dictionary],
  path: string,
  addMainlandTWDistinctions = true,
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
    let adjustedMeaning = `【${termTrad}】`;
    if (!!termSimpl && termTrad !== termSimpl)
      adjustedMeaning += ` 【${termSimpl}】`;
    const meanings: string[] = [];
    for (let i = 1; i <= 30; i++) {
      const meaning = entry[`釋義${i}`] as string | undefined;
      if (meaning) {
        meanings.push(`\n${meaning}`);
      } else {
        break;
      }
    }
    let additionalInfo = "";
    if (addMainlandTWDistinctions) {
      if (taiwanOrChinaTerm) additionalInfo += `詞: ${taiwanOrChinaTerm} `;
      if (taiwanOrChinaReading) additionalInfo += `音: ${taiwanOrChinaReading}`;
      if (additionalInfo.length > 0) additionalInfo = " " + additionalInfo;
    }
    const zhuyinTermEntry = new TermEntry(termTrad)
      .setReading(zhuyinReading)
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition(
        adjustedMeaning +
          (mZhuyinReading && mZhuyinReading !== zhuyinReading
            ? `大陸音讀: 【${mZhuyinReading}】`
            : "") +
          additionalInfo +
          meanings.join("")
      );
    const pinyinTermEntry = new TermEntry(termTrad)
      .setReading(pinyinReading ?? "")
      .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
      .addDetailedDefinition(
        adjustedMeaning +
          (mPinyinReading && mPinyinReading !== pinyinReading
            ? `大陸漢拼: 【${mPinyinReading}】`
            : "") +
          additionalInfo +
          meanings.join("")
      );
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
