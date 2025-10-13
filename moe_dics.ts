import { Dictionary, DictionaryIndex, TermEntry } from "yomichan-dict-builder";
import { readdirSync, readFileSync } from "fs";
import { read, utils } from "xlsx";
import _OpenCC from "opencc";
import type {
  DetailedDefinition,
  StructuredContent,
  StructuredContentNode,
} from "yomichan-dict-builder/dist/types/yomitan/termbank";
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
export type MoeEntry = Record<string, string | undefined> & typeof someEntry;

export async function addFilesConcised(
  [zhuyinConcisedDic, pinyinConcisedDic]: [Dictionary, Dictionary],
  concisedPicFolder: string
) {
  // add everything from the folder
  readdirSync(concisedPicFolder).forEach((file) => {
    const filePath = `${concisedPicFolder}/${file}`;
    zhuyinConcisedDic.addFile(filePath, `img/${file}`);
    pinyinConcisedDic.addFile(filePath, `img/${file}`);
  });
}

export async function addTermsMoe(
  [zhuyinConcisedDic, pinyinConcisedDic, zhuyinRevisedDic, pinyinRevisedDic]: [
    Dictionary,
    Dictionary,
    Dictionary,
    Dictionary
  ],
  [concisedPath, revisedPath, concisedPicsIndexPath, concisedPicsPath]: [
    string,
    string,
    string,
    string
  ],
  addSynonymsAntonyms = true
) {
  await addFilesConcised(
    [zhuyinConcisedDic, pinyinConcisedDic],
    concisedPicsPath
  );
  const fbConcised = readFileSync(concisedPath);
  const fbRevised = readFileSync(revisedPath);
  const fbConcisedPicsIndex = readFileSync(concisedPicsIndexPath);
  const workbookConcised = read(fbConcised);
  const workbookRevised = read(fbRevised);
  const workbookConcisedPicsIndex = read(fbConcisedPicsIndex);
  const sheetConcised =
    workbookConcised.Sheets[workbookConcised.SheetNames[0]!]!;
  const sheetRevised = workbookRevised.Sheets[workbookRevised.SheetNames[0]!]!;
  const sheetConcisedPicsIndex =
    workbookConcisedPicsIndex.Sheets[workbookConcisedPicsIndex.SheetNames[0]!]!;
  const dataConcised = utils.sheet_to_json(sheetConcised) as MoeEntry[];
  const dataRevised = utils.sheet_to_json(sheetRevised) as MoeEntry[];
  const dataConcisedPicsIndex = (
    utils.sheet_to_json(sheetConcisedPicsIndex) as {
      字詞號: string;
      圖片題名: string;
      檔案名稱: string;
    }[]
  ).reduce((acc, cur) => {
    const prev = (acc[cur.字詞號.trim()] || []) as {
      title: string;
      fileName: string;
    }[];
    prev.push({
      title: cur.圖片題名.trim(),
      fileName: cur.檔案名稱.trim(),
    });
    acc[cur.字詞號.trim()] = prev;
    return acc;
  }, {} as Record<string, { title: string; fileName: string }[]>);
  const simplifiedConverter = new OpenCC("tw2s.json");

  let processedEntries = 0;
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
      const contentZhuyin: StructuredContent = [
        adjustedMeaning +
          (altZhuyinReading ? `變體注音: 【${altZhuyinReading}】` : "") +
          "\n" +
          additionalFieldsRow +
          meaning,
      ];
      const contentPinyin: StructuredContent = [
        adjustedMeaning +
          (altPinyinReading ? `變體漢語拼音: 【${altPinyinReading}】` : "") +
          "\n" +
          additionalFieldsRow +
          meaning,
      ];
      const entryId = (entry.字詞號 ?? "").trim();
      if (i === 0 && entryId && dataConcisedPicsIndex[entryId]) {
        const pics = dataConcisedPicsIndex[entryId]!.toSorted((a, b) =>
          a.title.localeCompare(b.title, "zh-Hant-TW")
        );
        pics.forEach(({ title, fileName }) => {
          const imgEl = {
            tag: "details",
            style: { cursor: "pointer" },
            content: [
              { tag: "summary", content: `圖片: ${title}`, lang: "zh-TW" },
              {
                tag: "img",
                path: "img/" + fileName,
                collapsed: false,
                collapsible: false,
                background: false,
              },
            ],
          } as StructuredContentNode;
          contentZhuyin.push(imgEl);
          contentPinyin.push(imgEl);
        });
      }
      const zhuyinTermEntry = new TermEntry(term)
        .setReading(zhuyinReading ?? "")
        .addDetailedDefinition({
          type: "structured-content",
          content: contentZhuyin,
        });
      const pinyinTermEntry = new TermEntry(term)
        .setReading(pinyinReading ?? "")
        .addDetailedDefinition({
          type: "structured-content",
          content: contentPinyin,
        });

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
      if (++processedEntries % 10000 === 0) {
        console.log(`Processed ${processedEntries} entries`);
      }
    }
  }
}
