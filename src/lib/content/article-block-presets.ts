import { articleBlockPresetDir } from "@/lib/content/roster-workflow";

export const ARTICLE_BLOCK_PRESET_DIR = articleBlockPresetDir("content");
export const ARTICLE_BLOCK_INDEX_REL = `${ARTICLE_BLOCK_PRESET_DIR}/index.yaml`;

export type ArticleBlockPresetMeta = {
  id: string;
  name: string;
  series: string;
  slot: string;
  file: string;
  description: string;
};

export type ArticleBlockPreset = ArticleBlockPresetMeta & {
  markdown: string;
};

export function parseArticleBlockIndex(raw: string): ArticleBlockPresetMeta[] {
  const chunks = raw.split(/^\s*- id:\s*/m).slice(1);
  return chunks
    .map((chunk) => {
      const id = chunk.split(/\r?\n/, 1)[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
      const field = (key: string) =>
        chunk.match(new RegExp(`^[ \\t]+${key}:\\s*(.+?)\\s*$`, "m"))?.[1]?.trim().replace(/^['"]|['"]$/g, "") ??
        "";
      return {
        id,
        name: field("name") || id,
        series: field("series"),
        slot: field("slot"),
        file: field("file"),
        description: field("description"),
      };
    })
    .filter((item) => item.id && item.file && !item.file.includes(".."));
}

export function fillArticleBlockPlaceholders(
  markdown: string,
  values: Record<string, string>,
): string {
  return markdown.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (all, key: string) => {
    const value = values[key]?.trim();
    return value || all;
  });
}
