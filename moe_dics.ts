import { Dictionary, TermEntry } from "yomichan-dict-builder";
import { readdirSync, readFileSync } from "fs";
import { read, utils } from "xlsx";
import _OpenCC from "opencc";
import type {
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
  多音排序: "0",
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

type AltReadingType = "變" | "又音" | "語音" | "讀音";

function getAltReadingContent(
  altReadingType: string,
  switchAltPronunciations: boolean,
  reading?: string
): StructuredContentNode {
  switch (altReadingType as AltReadingType) {
    case "變":
      return {
        tag: "span",
        data: { moedict: "alt-reading-parent", altReadingType },
        content: [
          {
            tag: "span",
            content: `${switchAltPronunciations ? "本音" : "變體注音"}`,
            data: { moedict: "alt-reading-label" },
          },
          {
            tag: "span",
            data: { moedict: "alt-reading-content" },
            content: reading ?? "",
          },
        ],
      };
    case "又音":
      const youin: StructuredContentNode = {
        tag: "span",
        content: "又音",
        data: { moedict: "alt-reading-label" },
      };
      return {
        tag: "span",
        data: { moedict: "alt-reading-parent", altReadingType },
        content: [
          reading
            ? [
                youin,
                {
                  tag: "span",
                  data: { moedict: "alt-reading-content" },
                  content: reading,
                },
              ]
            : youin,
        ],
      };
    case "語音":
    case "讀音":
      return {
        tag: "span",
        data: { moedict: "alt-reading-parent", altReadingType },
        content: {
          tag: "span",
          content: altReadingType,
          data: { moedict: "alt-reading-label" },
        },
      };
    default:
      return "";
  }
}

function getExample(
  label: string,
  content: string,
  dic: "Concised" | "Revised"
) {
  return {
    tag: "span",
    content: [
      {
        tag: "span",
        content: label,
        data: { moedict: "definition-entry-example-label" },
      },
      {
        tag: "span",
        content,
        data: { moedict: "definition-entry-example-content" },
      },
    ],
    data: {
      moedict: "definition-entry-example-parent",
      type: dic === "Concised" || label === "如" ? "例" : "書",
    },
  } as StructuredContentNode;
}

const revisedExampleSentencesPattern =
  /。[^\n。」]*?：[「〈].*?[」〉](?:、?[「〈].*?[」〉])*/g;
function getContent(
  contentRaw: string,
  dic: "Concised" | "Revised"
): StructuredContentNode {
  const definitions = contentRaw.split("\n").map((definition) => {
    const examples = [] as StructuredContentNode[];
    let adjustedDefinition = definition;
    if (dic === "Revised") {
      let matches: RegExpMatchArray | null = null;
      while (
        (matches = adjustedDefinition.match(revisedExampleSentencesPattern)) !==
        null
      ) {
        matches?.forEach((match) => {
          const adjusted = match.replace("。", "");
          const split = adjusted.split("：");
          const [label, content] = [split[0]!, split.slice(1).join("：")];
          const example = getExample(label, content, "Revised");
          label === "如" ? examples.unshift(example) : examples.push(example);
          adjustedDefinition = adjustedDefinition.replace(match, "。");
        });
        adjustedDefinition = adjustedDefinition.replace("。。", "。");
      }
    }
    let content: StructuredContentNode =
      adjustedDefinition
        .match(/(^.*?(?=(\[例\])))|(^.*(?!(\[例\])))/g)
        ?.at(0) ?? "";
    const pos = content.match(/^.*(?=：\(\d\))|((?<=：)\(\d\)).*/g);
    if (pos && pos.length === 2) {
      const [posLabel, posContent] = pos;
      content = [
        {
          tag: "span",
          content: posLabel,
          data: { moedict: "pos-label" },
        },
        {
          tag: "span",
          content: [{ tag: "br" }, posContent ?? ""],
          data: { moedict: "pos-first-content" },
        },
      ] satisfies StructuredContentNode;
    }
    if (dic === "Concised")
      examples.push(
        getExample(
          "例",
          adjustedDefinition.match(/(?<=\[例\]).*/g)?.at(0) ?? "",
          "Concised"
        )
      );
    return {
      tag: "div",
      content: [
        {
          tag: "span",
          content,
          data: { moedict: "definition-entry-content" },
        },
        examples,
      ],
      data: { moedict: "definition-entry" },
    };
  }) satisfies StructuredContentNode[];
  return {
    tag: "div",
    content: definitions,
    data: { moedict: "meaning-parent" },
  };
}

function getMeaning(
  meaningRaw: string,
  term: string,
  dic: "Concised" | "Revised"
): StructuredContentNode {
  const parent = {
    tag: "div",
    content: [] as StructuredContentNode,
    data: { moedict: "meanings-parent" },
  } satisfies StructuredContentNode;
  const poss = meaningRaw.match(/(?<=\[).*?(?=\]\n)/g);
  const contents = meaningRaw.match(/(?<=\]\n).*?((?=\[)|$)/gs);
  if (poss?.length !== contents?.length)
    throw new Error(`how?, ${meaningRaw}, term: ${term}`);
  if (!poss || !contents || poss.length < 1) {
    parent.content = getContent(meaningRaw, dic);
    return parent;
  }
  parent.content = {
    tag: "div",
    content: poss.map(
      (pos, i) =>
        ({
          tag: "div",
          content: [
            { tag: "span", content: pos, data: { moedict: "pos-label" } },
            {
              tag: "div",
              content: getContent(contents[i] ?? "", dic),
              data: { moedict: "pos-content" },
            },
          ],
          data: { moedict: "pos-entry-parent" },
        } satisfies StructuredContentNode)
    ),
    data: { moedict: "pos-parent" },
  } satisfies StructuredContentNode;
  return parent;
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
  addSynonymsAntonyms = true,
  switchAltPronunciations = true,
  popularityBoost = 100
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
            .join("\n")
            // fixes words like "(1) ...　(2) ..." to be on separate lines (like 為, 于)
            .replace(/\(\d+\).*?(?=\()/g, (match) => {
              match = match.trim();
              // if (match.startsWith("(1")) match = "\n" + match;
              return match + "\n";
            });
        } else if (["注音一式", "變體注音"].includes(key)) {
          entry[key] = entry[key]?.replaceAll("\u3000", "");
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
        多音排序: order,
        "變體類型 1:變 2:又音 3:語音 4:讀音": altReadingType,
      } = entry;
      const simplifiedTerm = simplifiedConverter.convertSync(term);
      const termsParent: StructuredContentNode = {
        tag: "span",
        content: [],
        data: { moedict: "terms-parent" },
      };
      (termsParent.content as StructuredContentNode[]).push({
        tag: "span",
        content: `${term}`,
        data: { moedict: "traditional-term" },
      });
      if (term !== simplifiedTerm)
        (termsParent.content as StructuredContentNode[]).push({
          tag: "span",
          content: `${simplifiedTerm}`,
          data: { moedict: "simplified-term" },
          lang: "zh-CN",
        });
      const additionalFieldsParent: StructuredContentNode = {
        tag: "div",
        content: [],
        data: { moedict: "additional-fields-parent" },
      };
      if (addSynonymsAntonyms) {
        if (synonyms) {
          const parentDiv: StructuredContentNode = {
            tag: "div",
            content: [],
            data: { moedict: "synonyms-parent" },
          };
          (parentDiv.content as StructuredContentNode[]).push({
            tag: "span",
            content: "似",
            data: { moedict: "synonyms-label" },
          });
          (parentDiv.content as StructuredContentNode[]).push({
            tag: "span",
            content: synonyms.replace("[似]", ""),
            data: { moedict: "synonyms-content" },
          });
          (additionalFieldsParent.content as StructuredContentNode[]).push(
            parentDiv
          );
        }
        if (antonyms) {
          const parentDiv: StructuredContentNode = {
            tag: "div",
            content: [],
            data: { moedict: "antonyms-parent" },
          };
          (parentDiv.content as StructuredContentNode[]).push({
            tag: "span",
            content: "反",
            data: { moedict: "antonyms-label" },
          });
          (parentDiv.content as StructuredContentNode[]).push({
            tag: "span",
            content: antonyms.replace("[反]", ""),
            data: { moedict: "antonyms-content" },
          });
          (additionalFieldsParent.content as StructuredContentNode[]).push(
            parentDiv
          );
        }
      }
      const [adjustedZhuyinReading, adjustedPinyinReading] =
        switchAltPronunciations && (altReadingType as AltReadingType) === "變"
          ? [
              altZhuyinReading ?? zhuyinReading,
              altPinyinReading ?? pinyinReading,
            ]
          : [zhuyinReading, pinyinReading];
      const [adjustedAltZhuyinReading, adjustedAltPinyinReading] =
        switchAltPronunciations && (altReadingType as AltReadingType) === "變"
          ? [
              zhuyinReading !== adjustedZhuyinReading
                ? zhuyinReading
                : undefined,
              pinyinReading !== adjustedPinyinReading
                ? pinyinReading
                : undefined,
            ]
          : [altZhuyinReading, altPinyinReading];
      const meaningElement = getMeaning(
        meaning,
        term,
        i === 0 ? "Concised" : "Revised"
      );
      const contentZhuyin: StructuredContent = [
        {
          tag: "span",
          content: [
            termsParent,
            getAltReadingContent(
              altReadingType,
              switchAltPronunciations,
              adjustedAltZhuyinReading
            ),
          ],
          data: { moedict: "first-row-parent" },
        },
        (additionalFieldsParent.content as StructuredContentNode[]).length > 0
          ? additionalFieldsParent
          : "",
        meaningElement,
      ];
      const contentPinyin: StructuredContent = [
        {
          tag: "span",
          content: [
            termsParent,
            getAltReadingContent(
              altReadingType,
              switchAltPronunciations,
              adjustedAltPinyinReading
            ),
          ],
          data: { moedict: "first-row-parent" },
        },
        (additionalFieldsParent.content as StructuredContentNode[]).length > 0
          ? additionalFieldsParent
          : "",
        meaningElement,
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
              { tag: "summary", content: `圖片: ${title}` },
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
        .setReading(adjustedZhuyinReading ?? "")
        .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
        .addDetailedDefinition({
          type: "structured-content",
          content: { tag: "span", content: contentZhuyin, lang: "zh-TW" },
        });
      const pinyinTermEntry = new TermEntry(term)
        .setReading(adjustedPinyinReading ?? "")
        .setPopularity(order ? -parseInt(order) + popularityBoost : 0)
        .addDetailedDefinition({
          type: "structured-content",
          content: { tag: "span", content: contentPinyin, lang: "zh-TW" },
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
