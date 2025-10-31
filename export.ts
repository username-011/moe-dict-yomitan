import { Dictionary, DictionaryIndex } from "yomichan-dict-builder";
import { addTermsMoe } from "./moe_dics.ts";
import { addTermsLiangAn } from "./liangan.ts";

// only the 變 type
const concisedSwitchAltPronunciations = true;
// for the concised and revised moe dictionaries
const addSynonymsAntonyms = true;
// for the LiangAn dictionary
const addMainlandTWDistinctions = true;
// makes it so these dictionaries are prioritized in the search results (because they have some sort of frequency sort for the 多音字)
const popularityBoost = 100;

const [
  zhuyinConcisedDic,
  pinyinConcisedDic,
  zhuyinRevisedDic,
  pinyinRevisedDic,
  liangAnDicZhuyin,
  liangAnDicPinyin,
] = await initDics();

await addTermsMoe(
  [zhuyinConcisedDic, pinyinConcisedDic, zhuyinRevisedDic, pinyinRevisedDic],
  [
    "dict/dict_concised_2014_20250925.xlsx",
    "dict/dict_revised_2015_20250923.xlsx",
    "dict/dict_concised_pic_2014_20250925.xlsx",
    "dict/dict_concised_pic_2014_20250925",
  ],
  addSynonymsAntonyms,
  concisedSwitchAltPronunciations,
  popularityBoost
);

[
  zhuyinConcisedDic,
  pinyinConcisedDic,
  zhuyinRevisedDic,
  pinyinRevisedDic,
  liangAnDicZhuyin,
  liangAnDicPinyin,
].forEach((f) => f.addFile("./styles.css", "styles.css"));
console.log("Exporting MOE dictionaries...");
await zhuyinConcisedDic.export("build");
console.log("Exported 國語辭典簡編本 注音");
await pinyinConcisedDic.export("build");
console.log("Exported 國語辭典簡編本 拼音");
await zhuyinRevisedDic.export("build");
console.log("Exported 重編國語辭典修訂本 注音");
await pinyinRevisedDic.export("build");
console.log("Exported 重編國語辭典修訂本 拼音");

await addTermsLiangAn(
  [liangAnDicZhuyin, liangAnDicPinyin],
  "dict/liangancidian.xlsx",
  addMainlandTWDistinctions,
  popularityBoost
);

console.log("Exporting LiangAn dictionary...");
await liangAnDicZhuyin.export("build");
console.log("Exported 兩岸詞典 注音");
await liangAnDicPinyin.export("build");
console.log("Exported 兩岸詞典 拼音");

export async function initDics(): Promise<
  [Dictionary, Dictionary, Dictionary, Dictionary, Dictionary, Dictionary]
> {
  const zhuyinConcisedDic = new Dictionary({
    fileName: "moe-concised-zhuyin.zip",
  });
  const pinyinConcisedDic = new Dictionary({
    fileName: "moe-concised-pinyin.zip",
  });
  const zhuyinRevisedDic = new Dictionary({
    fileName: "moe-revised-zhuyin.zip",
  });
  const pinyinRevisedDic = new Dictionary({
    fileName: "moe-revised-pinyin.zip",
  });
  const zhuyinIndexConcised = new DictionaryIndex()
    .setTitle("國語辭典簡編本 注音")
    .setRevision("2025/10/31b")
    .setAuthor("shadow")
    .setAttribution("國語辭典簡編本 (2014)")
    .setDescription(
      "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
    )
    .setIsUpdatable(true)
    .setIndexUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-concised-zhuyin.json"
    )
    .setDownloadUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/moe-concised-zhuyin.zip"
    );
  zhuyinIndexConcised.index.sourceLanguage = "zh";
  zhuyinIndexConcised.index.targetLanguage = "zh";
  const pinyinIndexConcised = new DictionaryIndex()
    .setTitle("國語辭典簡編本 拼音")
    .setRevision("2025/10/31b")
    .setAuthor("shadow")
    .setAttribution("國語辭典簡編本 (2014)")
    .setDescription(
      "A monolingual dictionary made for learners of Mandarin Chinese. 主要適用對象：國中、小學生及學習華語人士。"
    )
    .setIsUpdatable(true)
    .setIndexUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-concised-pinyin.json"
    )
    .setDownloadUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/moe-concised-pinyin.zip"
    );
  pinyinIndexConcised.index.sourceLanguage = "zh";
  pinyinIndexConcised.index.targetLanguage = "zh";
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
      .setRevision("2025/10/31b")
      .setDescription(
        "A monolingual dictionary made for Mandarin Chinese. 主要適用對象：對歷史語言有興趣的研究者。"
      )
      .setAttribution("重編國語辭典修訂本 (2015)")
      .setIsUpdatable(true)
      .setIndexUrl(
        "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-revised-zhuyin.json"
      )
      .setDownloadUrl(
        "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/moe-revised-zhuyin.zip"
      )
      .build(),
    "build",
    "index-revised-zhuyin.json"
  );
  await pinyinRevisedDic.setIndex(
    pinyinIndexConcised
      .setTitle("重編國語辭典修訂本 拼音")
      .setRevision("2025/10/31b")
      .setDescription(
        "A monolingual dictionary made for Mandarin Chinese. 主要適用對象：對歷史語言有興趣的研究者。"
      )
      .setIsUpdatable(true)
      .setIndexUrl(
        "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-revised-pinyin.json"
      )
      .setDownloadUrl(
        "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/moe-revised-pinyin.zip"
      )
      .setAttribution("重編國語辭典修訂本 (2015)")
      .build(),
    "build",
    "index-revised-pinyin.json"
  );

  const liangAnDicZhuyin = new Dictionary({
    fileName: "liangancidian-zhuyin.zip",
  });
  const liangAnDicPinyin = new Dictionary({
    fileName: "liangancidian-pinyin.zip",
  });
  const zhuyinIndexLiangAn = new DictionaryIndex()
    .setTitle("兩岸詞典 注音")
    .setRevision("2025/10/31b")
    .setAuthor("shadow")
    .setAttribution("兩岸詞典 (2015)")
    .setDescription("A monolingual dictionary of Mandarin Chinese.")
    .setIsUpdatable(true)
    .setIndexUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-liangancidian-zhuyin.json"
    )
    .setDownloadUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/liangancidian-zhuyin.zip"
    );
  zhuyinIndexLiangAn.index.sourceLanguage = "zh";
  zhuyinIndexLiangAn.index.targetLanguage = "zh";
  const pinyinIndexLiangAn = new DictionaryIndex()
    .setTitle("兩岸詞典 拼音")
    .setRevision("2025/10/31b")
    .setAuthor("shadow")
    .setAttribution("兩岸詞典 (2015)")
    .setDescription("A monolingual dictionary of Mandarin Chinese.")
    .setIsUpdatable(true)
    .setIndexUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/index-liangancidian-pinyin.json"
    )
    .setDownloadUrl(
      "https://github.com/username-011/moe-dict-yomitan/releases/latest/download/liangancidian-pinyin.zip"
    );
  pinyinIndexLiangAn.index.sourceLanguage = "zh";
  pinyinIndexLiangAn.index.targetLanguage = "zh";
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

  return [
    zhuyinConcisedDic,
    pinyinConcisedDic,
    zhuyinRevisedDic,
    pinyinRevisedDic,
    liangAnDicZhuyin,
    liangAnDicPinyin,
  ];
}
