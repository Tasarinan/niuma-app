import { parseYamlBlockList } from "@/lib/artifact/content-team-config";
import { draftFolderFromFilePath } from "@/lib/artifact/draft-workspace";

const PRESET_KEY = "default_format_preset";
const FLOW_LIST = new RegExp(`^${PRESET_KEY}:\\s*\\[([^\\]]*)\\]\\s*$`);
const META_SCALAR_KEYS = ["title", "author", "digest", "cover_image"] as const;

export type ArticleYamlMetaKey = (typeof META_SCALAR_KEYS)[number];

export interface ArticleYamlMeta {
  title?: string;
  author?: string;
  digest?: string;
  cover_image?: string;
}

function unquoteYamlScalar(raw: string): string {
  const value = raw.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

function quoteYamlScalar(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function parseArticleYamlMeta(yamlText: string): ArticleYamlMeta {
  const meta: ArticleYamlMeta = {};
  for (const line of yamlText.replace(/\r\n/g, "\n").split("\n")) {
    for (const key of META_SCALAR_KEYS) {
      const match = line.match(new RegExp(`^${key}:\\s*(.+?)\\s*(?:#.*)?$`));
      if (!match) continue;
      meta[key] = unquoteYamlScalar(match[1]);
    }
  }
  return meta;
}

export function upsertArticleYamlMeta(yamlText: string, patch: ArticleYamlMeta): string {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const pending = new Map<string, string>();
  for (const key of META_SCALAR_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    pending.set(key, `${key}: ${quoteYamlScalar(value)}`);
  }
  if (pending.size === 0) return joinYaml(lines);

  for (let index = 0; index < lines.length; index += 1) {
    for (const key of META_SCALAR_KEYS) {
      if (!pending.has(key)) continue;
      if (!new RegExp(`^${key}:`).test(lines[index])) continue;
      lines[index] = pending.get(key)!;
      pending.delete(key);
    }
  }

  if (pending.size > 0) {
    const insertOrder = ["title", "author", "digest", "cover_image"] as const;
    const block = insertOrder.filter((key) => pending.has(key)).map((key) => pending.get(key)!);
    lines.unshift(...block);
  }

  return joinYaml(lines);
}

export function articleYamlPathFromArticle(filePath: string): string | null {
  const folder = draftFolderFromFilePath(filePath);
  if (folder) return `${folder.replace(/\\/g, "/")}/article.yaml`;
  const normalized = filePath.replace(/\\/g, "/");
  if (/\/article\.md$/i.test(normalized)) {
    return normalized.replace(/\/article\.md$/i, "/article.yaml");
  }
  return null;
}

export function parseDefaultFormatPreset(yamlText: string): string | null {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const flow = line.match(FLOW_LIST);
    if (!flow) continue;
    const items = flow[1]
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    return items[0] ?? "";
  }
  if (new RegExp(`^${PRESET_KEY}:\\s*(?:#.*)?$`, "m").test(yamlText)) {
    const items = parseYamlBlockList(yamlText, PRESET_KEY);
    return items[0] ?? "";
  }
  return null;
}

export function upsertDefaultFormatPreset(yamlText: string, themeId: string): string {
  const id = themeId.trim();
  const block = [`${PRESET_KEY}:`, `  - ${id}`];
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const flowIndex = lines.findIndex((line) => FLOW_LIST.test(line));
  if (flowIndex >= 0) {
    lines.splice(flowIndex, 1, ...block);
    return joinYaml(lines);
  }
  const start = lines.findIndex((line) => new RegExp(`^${PRESET_KEY}:\\s*(?:#.*)?$`).test(line));
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (/^[ \t]+-/.test(line) || (/^[ \t]+#/.test(line) && line.trim().startsWith("#"))) {
        end += 1;
        continue;
      }
      break;
    }
    lines.splice(start, end - start, ...block);
    return joinYaml(lines);
  }
  const trimmed = yamlText.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  if (!trimmed) return `${block.join("\n")}\n`;
  return `${trimmed}\n${block.join("\n")}\n`;
}

function joinYaml(lines: string[]): string {
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}
