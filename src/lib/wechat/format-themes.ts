/** WeChat format themes shown in the editor. Ids match format.py YAML stems. */

import { formatThemeBuiltinDir, formatThemeUserDir } from "@/lib/content/roster-workflow";

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

export const FORMAT_THEME_USER_DIR = formatThemeUserDir("content");
export const FORMAT_THEME_BUILTIN_DIR = formatThemeBuiltinDir("content", "article-formatting-wechat");

export const FORMAT_THEME_GROUPS: { id: FormatThemeGroupId; label: string }[] = [
  { id: "niuma", label: "Niuma 原主题" },
  { id: "wechat-classic", label: "经典公众号" },
  { id: "media", label: "传统媒体" },
  { id: "digital", label: "现代数字" },
  { id: "design", label: "设计向" },
];

export const FORMAT_THEMES: FormatTheme[] = [
  { id: "default", name: "经典蓝", description: "沉稳大气的编辑风格，适合科技、商业类账号", group: "niuma" },
  { id: "grace", name: "优雅紫", description: "柔和圆润的风格，适合文化、美学类账号", group: "niuma" },
  { id: "modern", name: "暖橙", description: "活力大胆的风格，适合自媒体、创业", group: "niuma" },
  { id: "simple", name: "极简黑", description: "极度克制的留白风格，适合思想深度、学术", group: "niuma" },
  { id: "wechat-default", name: "默认公众号风格", description: "花生排版器 · 默认公众号风格", group: "wechat-classic" },
  { id: "latepost-depth", name: "晚点风格", description: "花生排版器 · 晚点风格", group: "wechat-classic" },
  { id: "wechat-ft", name: "金融时报", description: "花生排版器 · 金融时报", group: "media" },
  { id: "wechat-anthropic", name: "Claude", description: "花生排版器 · Claude", group: "digital" },
  { id: "wechat-tech", name: "技术风格", description: "花生排版器 · 技术风格", group: "wechat-classic" },
  { id: "wechat-elegant", name: "优雅简约", description: "花生排版器 · 优雅简约", group: "wechat-classic" },
  { id: "wechat-deepread", name: "深度阅读", description: "花生排版器 · 深度阅读", group: "wechat-classic" },
  { id: "wechat-nyt", name: "纽约时报", description: "花生排版器 · 纽约时报", group: "media" },
  { id: "wechat-jonyive", name: "Jony Ive", description: "花生排版器 · Jony Ive", group: "media" },
  { id: "wechat-medium", name: "Medium 长文", description: "花生排版器 · Medium 长文", group: "digital" },
  { id: "wechat-apple", name: "Apple 极简", description: "花生排版器 · Apple 极简", group: "digital" },
  { id: "kenya-emptiness", name: "原研哉·空", description: "花生排版器 · 原研哉·空", group: "design" },
  { id: "hische-editorial", name: "Hische·编辑部", description: "花生排版器 · Hische·编辑部", group: "design" },
  { id: "ando-concrete", name: "安藤·清水", description: "花生排版器 · 安藤·清水", group: "design" },
  { id: "gaudi-organic", name: "高迪·有机", description: "花生排版器 · 高迪·有机", group: "design" },
  { id: "guardian", name: "Guardian 卫报", description: "花生排版器 · Guardian 卫报", group: "media" },
  { id: "nikkei", name: "Nikkei 日経", description: "花生排版器 · Nikkei 日経", group: "media" },
  { id: "warm-docs", name: "焦橙文档", description: "花生排版器 · 焦橙文档", group: "design" },
  { id: "warm-dossier", name: "档案馆", description: "花生排版器 · 档案馆", group: "design" },
  { id: "lemonde", name: "Le Monde 世界报", description: "花生排版器 · Le Monde 世界报", group: "media" },
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
