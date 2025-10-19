import { DOMParser } from "@xmldom/xmldom";
import { readFileSync } from "fs";
import type {
  StructuredContent,
  StructuredContentNode,
  StructuredContentStyle,
} from "yomichan-dict-builder/dist/types/yomitan/termbank";

const possibleStyle = {
  fontStyle: "normal",
  fontWeight: "normal",
  fontSize: "",
  color: "",
  background: "",
  backgroundColor: "",
  textDecorationLine: "none",
  textDecorationStyle: "solid",
  textDecorationColor: "",
  borderColor: "",
  borderStyle: "",
  borderRadius: "",
  borderWidth: "",
  clipPath: "",
  verticalAlign: "baseline",
  textAlign: "start",
  textEmphasis: "",
  textShadow: "",
  margin: "",
  marginTop: "",
  marginLeft: "",
  marginRight: "",
  marginBottom: "",
  padding: "",
  paddingTop: "",
  paddingLeft: "",
  paddingRight: "",
  paddingBottom: "",
  wordBreak: "normal",
  whiteSpace: "",
  cursor: "",
  listStyleType: "",
};

function kebabToCamelCase(kebabString: string) {
  return kebabString.replace(/-([a-z])/g, (match, char) => char.toUpperCase());
}

function parseStyle(s: string): StructuredContentStyle {
  const style: StructuredContentStyle = {};
  s.split(";").forEach((declaration) => {
    const [property, value] = declaration.split(":").map((item) => item.trim());
    if (property && value) {
      const prop = kebabToCamelCase(property);
      if (prop in possibleStyle)
        style[prop as keyof StructuredContentStyle] = value as any;
    }
  });
  return style;
}

function add(node: ChildNode | null): StructuredContentNode[] {
  const content: StructuredContentNode[] = [];
  if (!node) return content;
  switch (node.nodeName) {
    case "table":
    case "tbody":
    case "thead":
    case "tfoot":
    case "tr":
      content.push({
        tag: node.nodeName.toLowerCase() as
          | "table"
          | "tbody"
          | "thead"
          | "tfoot"
          | "tr",
        content: Array.from(node.childNodes).map((c) => add(c)),
        lang: "zh-TW",
      });
      break;
    case "td":
    case "th":
      content.push({
        tag: node.nodeName.toLowerCase() as "td" | "th",
        content: Array.from(node.childNodes).map((c) => add(c)),
        style: parseStyle((node as Element).getAttribute("style") || ""),
        lang: "zh-TW",
      });
      break;
    default:
      content.push(node.textContent || "");
      break;
  }
  return content;
}

export default function parse_html(data: string): StructuredContent {
  const doc = new DOMParser().parseFromString(
    `<span>${data}</span>`,
    "text/html"
  );
  const content: StructuredContent = [];
  Array.from(doc.childNodes.item(0).childNodes).forEach((node) => {
    content.push(...add(node));
  });
  return content.filter((item) => item !== "");
}
