/**
 * One-shot importer: huasheng_editor styles.js → format.py YAML + UI catalog.
 * Source: https://github.com/alchaincyf/huasheng_editor (MIT)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stylesJsPath = process.argv[2];
if (!stylesJsPath) {
  console.error("usage: node import-huasheng-styles.mjs <styles.js>");
  process.exit(1);
}

const STYLES = new Function(`${fs.readFileSync(stylesJsPath, "utf8")}\nreturn STYLES;`)();

const GROUPS = {
  "wechat-default": ["wechat-classic", "经典公众号"],
  "wechat-tech": ["wechat-classic", "经典公众号"],
  "wechat-elegant": ["wechat-classic", "经典公众号"],
  "wechat-deepread": ["wechat-classic", "经典公众号"],
  "latepost-depth": ["wechat-classic", "经典公众号"],
  "wechat-ft": ["media", "传统媒体"],
  "wechat-nyt": ["media", "传统媒体"],
  "wechat-jonyive": ["media", "传统媒体"],
  guardian: ["media", "传统媒体"],
  nikkei: ["media", "传统媒体"],
  lemonde: ["media", "传统媒体"],
  "wechat-anthropic": ["digital", "现代数字"],
  "wechat-medium": ["digital", "现代数字"],
  "wechat-apple": ["digital", "现代数字"],
  "kenya-emptiness": ["design", "设计向"],
  "hische-editorial": ["design", "设计向"],
  "ando-concrete": ["design", "设计向"],
  "gaudi-organic": ["design", "设计向"],
  "warm-docs": ["design", "设计向"],
  "warm-dossier": ["design", "设计向"],
};

const NIUMA = [
  { id: "default", name: "经典蓝", description: "沉稳大气的编辑风格，适合科技、商业类账号", group: "niuma" },
  { id: "grace", name: "优雅紫", description: "柔和圆润的风格，适合文化、美学类账号", group: "niuma" },
  { id: "modern", name: "暖橙", description: "活力大胆的风格，适合自媒体、创业", group: "niuma" },
  { id: "simple", name: "极简黑", description: "极度克制的留白风格，适合思想深度、学术", group: "niuma" },
];

const skillDir = path.resolve(here, "..");
const niumaApp = path.resolve(here, "../../../../../");
const themesDir = path.join(niumaApp, ".teams", "content", "editor", "themes", "builtin");
const catalogPath = path.join(niumaApp, "src", "lib", "wechat", "format-themes.ts");

function pickCss(css, prop) {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const m = ` ${css}`.match(re);
  return m ? m[1].replace(/\s*!important/gi, "").trim() : "";
}

function yamlQuote(value) {
  return JSON.stringify(String(value ?? ""));
}

const catalog = [...NIUMA];

for (const [id, entry] of Object.entries(STYLES)) {
  const styles = entry.styles ?? {};
  const container = styles.container ?? "";
  const strong = styles.strong ?? "";
  const anchor = styles.a ?? "";
  const fontSize = pickCss(container, "font-size") || "16px";
  const lineHeight = pickCss(container, "line-height") || "1.8";
  const textColor = pickCss(container, "color") || "#333333";
  const fontFamily = pickCss(container, "font-family") || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const primary = pickCss(strong, "color") || pickCss(anchor, "color") || "#0F4C81";
  const linkColor = pickCss(anchor, "color") || primary;
  const group = GROUPS[id] ?? ["design", "设计向"];
  const name = entry.name || id;

  catalog.push({
    id,
    name,
    description: `花生排版器 · ${name}`,
    group: group[0],
  });

  const styleLines = Object.entries(styles)
    .map(([key, val]) => `  ${key}: ${yamlQuote(val)}`)
    .join("\n");

  const yaml = `# Adapted from huasheng_editor (MIT) by 花生 (alchaincyf)
# https://github.com/alchaincyf/huasheng_editor
name: ${yamlQuote(name)}
description: ${yamlQuote(`花生公众号排版器 · ${name}`)}
source: huasheng_editor

variables:
  primary-color: ${yamlQuote(primary)}
  text-color: ${yamlQuote(textColor)}
  link-color: ${yamlQuote(linkColor)}
  font-size: ${yamlQuote(fontSize)}
  font-family: ${yamlQuote(fontFamily)}
  line-height: ${yamlQuote(lineHeight)}

styles:
${styleLines}
  strong-color: ${yamlQuote(primary)}
`;

  fs.writeFileSync(path.join(themesDir, `${id}.yaml`), yaml, "utf8");
}

const groupOrder = [
  ["niuma", "Niuma 原主题"],
  ["wechat-classic", "经典公众号"],
  ["media", "传统媒体"],
  ["digital", "现代数字"],
  ["design", "设计向"],
];

const ts = `/** WeChat format themes shown in the editor. Ids match format.py YAML stems. */

export type FormatThemeGroupId =
  | "niuma"
  | "wechat-classic"
  | "media"
  | "digital"
  | "design";

export type FormatTheme = {
  id: string;
  name: string;
  description: string;
  group: FormatThemeGroupId;
};

export const DEFAULT_FORMAT_THEME_ID = "default";

export const FORMAT_THEME_GROUPS: { id: FormatThemeGroupId; label: string }[] = [
${groupOrder.map(([id, label]) => `  { id: "${id}", label: "${label}" },`).join("\n")}
];

export const FORMAT_THEMES: FormatTheme[] = [
${catalog
  .map(
    (t) =>
      `  { id: ${JSON.stringify(t.id)}, name: ${JSON.stringify(t.name)}, description: ${JSON.stringify(t.description)}, group: ${JSON.stringify(t.group)} },`,
  )
  .join("\n")}
];

export function isKnownFormatTheme(id: string): boolean {
  return FORMAT_THEMES.some((theme) => theme.id === id);
}

export function formatThemeById(id: string): FormatTheme | undefined {
  return FORMAT_THEMES.find((theme) => theme.id === id);
}

export function formatThemesByGroup(group: FormatThemeGroupId): FormatTheme[] {
  return FORMAT_THEMES.filter((theme) => theme.group === group);
}
`;

fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
fs.writeFileSync(catalogPath, ts, "utf8");
console.log(`wrote ${Object.keys(STYLES).length} huasheng YAML themes + catalog ${catalog.length}`);
