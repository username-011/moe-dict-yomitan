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
};
type Entry = typeof someEntry;

const zhuyinDic = new Dictionary({ fileName: "moe-concised-zhuyin.zip" });
const pinyinDic = new Dictionary({ fileName: "moe-concised-pinyin.zip" });
const zhuyinIndex = new DictionaryIndex()
  .setTitle("國語辭典簡編本 注音")
  .setRevision("1.2")
  .setAuthor("shadow")
  .setAttribution("國語辭典簡編本 (2014)")
  .setDescription(
    "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
  )
  .build();
const pinyin = new DictionaryIndex()
  .setTitle("國語辭典簡編本 拼音")
  .setRevision("1.2")
  .setAuthor("shadow")
  .setAttribution("國語辭典簡編本 (2014)")
  .setDescription(
    "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
  )
  .build();

await zhuyinDic.setIndex(zhuyinIndex, "build", "index-zhuyin.json");
await pinyinDic.setIndex(pinyin, "build", "index-pinyin.json");

const fb = await fs.readFile("dict/dict_concised_2014_20250626.xlsx");
const workbook = read(fb);
const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
const data = utils.sheet_to_json(sheet) as Entry[];
console.log(
  data[7304]?.釋義
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
);
const simplifiedConverter = new OpenCC("tw2sp.json");
let i = 0;
for (const entry of data) {
  const {
    字詞名: term,
    注音一式: zhuyinReading,
    變體注音: altZhuyinReading,
    漢語拼音: pinyinReading,
    變體漢語拼音: altPinyinReading,
    釋義,
  } = entry;
  const simplifiedTerm = simplifiedConverter.convertSync(term);
  const trimmedMeaning = (釋義 ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
  let adjustedMeaning = `【${term}】 `;
  if (term !== simplifiedTerm) adjustedMeaning += `【${simplifiedTerm}】 `;
  const zhuyin = zhuyinReading.trim();
  const pinyin = pinyinReading.trim();
  const zhuyinTermEntry = new TermEntry(term)
    .setReading(zhuyin)
    .addDetailedDefinition(
      adjustedMeaning +
        (altZhuyinReading && altZhuyinReading.trim()
          ? `變體注音: 【${altZhuyinReading}】\n`
          : "\n") +
        trimmedMeaning
    );
  const pinyinTermEntry = new TermEntry(term)
    .setReading(pinyin)
    .addDetailedDefinition(
      adjustedMeaning +
        (altPinyinReading && altPinyinReading.trim()
          ? `變體漢語拼音: 【${altPinyinReading}】\n`
          : "\n") +
        trimmedMeaning
    );
  await Promise.all([
    zhuyinDic.addTerm(zhuyinTermEntry.build()),
    pinyinDic.addTerm(pinyinTermEntry.build()),
  ]);
  if (term !== simplifiedTerm) {
    zhuyinTermEntry.setTerm(simplifiedTerm);
    pinyinTermEntry.setTerm(simplifiedTerm);
    await Promise.all([
      zhuyinDic.addTerm(zhuyinTermEntry.build()),
      pinyinDic.addTerm(pinyinTermEntry.build()),
    ]);
  }
  if (++i % 1000 === 0) {
    console.log(`Processed ${i} entries`);
  }
}

await zhuyinDic.export("build");
await pinyinDic.export("build");
