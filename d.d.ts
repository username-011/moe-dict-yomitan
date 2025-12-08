declare module "pinyin-tone-tool" {
  function findSyllableBoundaries(s: string): { start: number; end: number }[];
}
