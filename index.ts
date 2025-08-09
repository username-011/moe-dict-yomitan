import { Dictionary, DictionaryIndex, TermEntry } from "yomichan-dict-builder";
import { read, utils } from "xlsx";
import * as fs from "fs/promises";
import _OpenCC from "opencc";
const { OpenCC } = _OpenCC;

const someEntry = {
  __rowNum__: 2541,
  字詞名: "牌",
  字詞號: "0323",
  部首字: "片 ",
  總筆畫數: 12,
  部首外筆畫數: 8,
  多音排序: 0,
  注音一式: "ㄆㄞˊ",
  變體注音: "abc",
  "變體類型 1:變 2:又音 3:語音 4:讀音": "  ",
  漢語拼音: "pái",
  變體漢語拼音: "abc",
  釋義: "1.揭示或標誌用的看板。[例]門牌、車牌、招牌\n2.商標。[例]總統牌香菸\n3.神位。[例]牌位、靈牌、神主牌\n4.一種古代的兵器，即盾牌。[例]籐牌、擋箭牌\n5.賭具或娛樂用品。[例]橋牌、紙牌、撲克牌\n6.詞或曲的曲調名稱。[例]詞牌、曲牌",
  相似詞: "abc",
  相反詞: "def",
};
type Entry = Record<string, string | undefined> & typeof someEntry;

// for the concised and revised dictionaries
const addSynonymsAntonyms = true;
// for the LiangAn dictionary
const addMainlandTWDistinctions = true;

const zhuyinConcisedDic = new Dictionary({
  fileName: "moe-concised-zhuyin.zip",
});
const pinyinConcisedDic = new Dictionary({
  fileName: "moe-concised-pinyin.zip",
});
const zhuyinRevisedDic = new Dictionary({ fileName: "moe-revised-zhuyin.zip" });
const pinyinRevisedDic = new Dictionary({ fileName: "moe-revised-pinyin.zip" });
const zhuyinIndexConcised = new DictionaryIndex()
  .setTitle("國語辭典簡編本 注音")
  .setRevision("1.5")
  .setAuthor("shadow")
  .setAttribution("國語辭典簡編本 (2014)")
  .setDescription(
    "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
  );
const pinyinIndexConcised = new DictionaryIndex()
  .setTitle("國語辭典簡編本 拼音")
  .setRevision("1.5")
  .setAuthor("shadow")
  .setAttribution("國語辭典簡編本 (2014)")
  .setDescription(
    "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
  );
await zhuyinConcisedDic.setIndex(
  zhuyinIndexConcised.build(),
  "build",
  "index-concised-zhuyin.json"
);
await pinyinConcisedDic.setIndex(
  pinyinIndexConcised.build(),
  "build",
  "index-concised-pinyin.json"
);
await zhuyinRevisedDic.setIndex(
  zhuyinIndexConcised
    .setTitle("重編國語辭典修訂本 注音")
    .setRevision("1.3")
    .setDescription(
      "A monolingual dictionary made for Mandarin Chinese. 主要適用對象：對歷史語言有興趣的研究者。"
    )
    .setAttribution("重編國語辭典修訂本 (2015)")
    .build(),
  "build",
  "index-revised-zhuyin.json"
);
await pinyinRevisedDic.setIndex(
  pinyinIndexConcised
    .setTitle("重編國語辭典修訂本 拼音")
    .setRevision("1.3")
    .setDescription(
      "A monolingual dictionary made for Mandarin Chinese. 主要適用對象：對歷史語言有興趣的研究者。"
    )
    .setAttribution("重編國語辭典修訂本 (2015)")
    .build(),
  "build",
  "index-revised-pinyin.json"
);

const fbConcised = await fs.readFile("dict/dict_concised_2014_20250626.xlsx");
const fbRevised = await fs.readFile("dict/dict_revised_2015_20250627.xlsx");
const workbookConcised = read(fbConcised);
const workbookRevised = read(fbRevised);
const sheetConcised = workbookConcised.Sheets[workbookConcised.SheetNames[0]!]!;
const sheetRevised = workbookRevised.Sheets[workbookRevised.SheetNames[0]!]!;
const dataConcised = utils.sheet_to_json(sheetConcised) as Entry[];
const dataRevised = utils.sheet_to_json(sheetRevised) as Entry[];
const simplifiedConverter = new OpenCC("tw2s.json");
let a = 0;
for (let i = 0; i < 2; i++) {
  for (const entry of i === 0 ? dataConcised : dataRevised) {
    // trim all the fields of entry before processing
    for (const key in entry) {
      if (key === "釋義") {
        entry[key] = (entry[key] ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .join("\n");
      } else if (typeof entry[key] === "string") {
        entry[key] = entry[key].trim();
      }
    }

    const {
      字詞名: term,
      注音一式: zhuyinReading,
      變體注音: altZhuyinReading,
      漢語拼音: pinyinReading,
      變體漢語拼音: altPinyinReading,
      釋義: meaning,
      相似詞: synonyms,
      相反詞: antonyms,
    } = entry;
    const simplifiedTerm = simplifiedConverter.convertSync(term);
    let adjustedMeaning = `【${term}】`;
    if (term !== simplifiedTerm) adjustedMeaning += ` 【${simplifiedTerm}】`;
    let additionalFieldsRow = "";
    if (addSynonymsAntonyms) {
      if (synonyms) {
        if (i === 1) additionalFieldsRow += "[似]";
        additionalFieldsRow += synonyms;
      }
      if (antonyms) {
        if (additionalFieldsRow.length > 0) additionalFieldsRow += "\n";
        if (i === 1) additionalFieldsRow += "[反]";
        additionalFieldsRow += antonyms;
      }
      if (additionalFieldsRow.length > 0) additionalFieldsRow += "\n";
    }
    const zhuyinTermEntry = new TermEntry(term)
      .setReading(zhuyinReading ?? "")
      .addDetailedDefinition(
        adjustedMeaning +
          (altZhuyinReading ? `變體注音: 【${altZhuyinReading}】` : "") +
          "\n" +
          additionalFieldsRow +
          meaning
      );
    const pinyinTermEntry = new TermEntry(term)
      .setReading(pinyinReading ?? "")
      .addDetailedDefinition(
        adjustedMeaning +
          (altPinyinReading ? `變體漢語拼音: 【${altPinyinReading}】` : "") +
          "\n" +
          additionalFieldsRow +
          meaning
      );
    await Promise.all([
      i === 0
        ? zhuyinConcisedDic.addTerm(zhuyinTermEntry.build())
        : zhuyinRevisedDic.addTerm(zhuyinTermEntry.build()),
      i === 0
        ? pinyinConcisedDic.addTerm(pinyinTermEntry.build())
        : pinyinRevisedDic.addTerm(pinyinTermEntry.build()),
    ]);
    if (term !== simplifiedTerm) {
      zhuyinTermEntry.setTerm(simplifiedTerm);
      pinyinTermEntry.setTerm(simplifiedTerm);
      await Promise.all([
        i === 0
          ? zhuyinConcisedDic.addTerm(zhuyinTermEntry.build())
          : zhuyinRevisedDic.addTerm(zhuyinTermEntry.build()),
        i === 0
          ? pinyinConcisedDic.addTerm(pinyinTermEntry.build())
          : pinyinRevisedDic.addTerm(pinyinTermEntry.build()),
      ]);
    }
    if (++a % 10000 === 0) {
      console.log(`Processed ${a} entries`);
    }
  }
}

console.log("Exporting MOE dictionaries...");
await zhuyinConcisedDic.export("build");
console.log("Exported 國語辭典簡編本 注音");
await pinyinConcisedDic.export("build");
console.log("Exported 國語辭典簡編本 拼音");
await zhuyinRevisedDic.export("build");
console.log("Exported 重編國語辭典修訂本 注音");
await pinyinRevisedDic.export("build");
console.log("Exported 重編國語辭典修訂本 拼音");

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

const liangAnDicZhuyin = new Dictionary({
  fileName: "liangancidian-zhuyin.zip",
});
const liangAnDicPinyin = new Dictionary({
  fileName: "liangancidian-pinyin.zip",
});
const zhuyinIndexLiangAn = new DictionaryIndex()
  .setTitle("兩岸詞典 注音")
  .setRevision("1.3")
  .setAuthor("shadow")
  .setAttribution("兩岸詞典 (2015)")
  .setDescription("A monolingual dictionary of Mandarin Chinese.");
const pinyinIndexLiangAn = new DictionaryIndex()
  .setTitle("兩岸詞典 拼音")
  .setRevision("1.3")
  .setAuthor("shadow")
  .setAttribution("兩岸詞典 (2015)")
  .setDescription("A monolingual dictionary of Mandarin Chinese.");
await liangAnDicZhuyin.setIndex(
  zhuyinIndexLiangAn.build(),
  "build",
  "index-liangancidian-zhuyin.json"
);
await liangAnDicPinyin.setIndex(
  pinyinIndexLiangAn.build(),
  "build",
  "index-liangancidian-pinyin.json"
);

const fbLiangAn = await fs.readFile("dict/liangancidian.xlsx");
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

console.log("Exporting LiangAn dictionary...");
await liangAnDicZhuyin.export("build");
console.log("Exported 兩岸詞典 注音");
await liangAnDicPinyin.export("build");
console.log("Exported 兩岸詞典 拼音");
