/** WeChat format themes shown in the editor. Ids match format.py YAML stems. */

import { formatThemeBuiltinDir, formatThemeUserDir } from "@/lib/content/roster-workflow";

export type FormatThemeGroupId =
  | "niuma"
  | "wechat-classic"
  | "media"
  | "digital"
  | "design"
  | "macaron"
  | "wenyan"
  | "shuimo";

export type FormatTheme = {
  id: string;
  name: string;
  description: string;
  group: FormatThemeGroupId;
};

export const DEFAULT_FORMAT_THEME_ID = "default";

export const FORMAT_THEME_USER_DIR = formatThemeUserDir("content");
export const FORMAT_THEME_BUILTIN_DIR = formatThemeBuiltinDir("content", "wechat-formatting");

export const FORMAT_THEME_GROUPS: { id: FormatThemeGroupId; label: string }[] = [
  { id: "niuma", label: "Niuma 原主题" },
  { id: "wechat-classic", label: "经典公众号" },
  { id: "media", label: "传统媒体" },
  { id: "digital", label: "现代数字" },
  { id: "design", label: "设计向" },
  { id: "macaron", label: "马卡龙" },
  { id: "wenyan", label: "文颜" },
  { id: "shuimo", label: "水墨" },
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
  { id: "macaron-blue", name: "马卡龙蓝", description: "清新明亮，适合科技、商务、教育", group: "macaron" },
  { id: "macaron-coral", name: "马卡龙珊瑚", description: "温暖珊瑚色，适合情感、生活、旅行", group: "macaron" },
  { id: "macaron-cream", name: "马卡龙奶油", description: "奶油色，适合美食、烘焙、复古", group: "macaron" },
  { id: "macaron-lavender", name: "马卡龙薰衣草", description: "薰衣草色，适合艺术、设计、文学", group: "macaron" },
  { id: "macaron-lemon", name: "马卡龙柠檬", description: "柠檬色，适合财经、商业、励志", group: "macaron" },
  { id: "macaron-lilac", name: "马卡龙丁香", description: "丁香色，适合时尚、美妆、婚礼", group: "macaron" },
  { id: "macaron-mint", name: "马卡龙薄荷", description: "薄荷色，适合健康、环保、生活方式", group: "macaron" },
  { id: "macaron-peach", name: "马卡龙蜜桃", description: "蜜桃色，适合美食、生活、亲子", group: "macaron" },
  { id: "macaron-pink", name: "马卡龙粉", description: "粉色，适合情感、生活、女性向", group: "macaron" },
  { id: "macaron-rose", name: "马卡龙玫瑰", description: "玫瑰色，适合情感、浪漫、精致", group: "macaron" },
  { id: "macaron-sage", name: "马卡龙鼠尾草", description: "鼠尾草绿，适合健康、植物、园艺", group: "macaron" },
  { id: "macaron-sky", name: "马卡龙天空", description: "天空蓝，适合旅行、自由、梦想", group: "macaron" },
  { id: "wenyan-default", name: "文颜默认", description: "黑白灰 + 蓝色点缀，适合长文", group: "wenyan" },
  { id: "wenyan-lapis", name: "文颜青金石", description: "清凉蓝色，适合科技、商务、知识", group: "wenyan" },
  { id: "wenyan-maize", name: "文颜玉米", description: "玉米色，适合美食、生活、阳光", group: "wenyan" },
  { id: "wenyan-mint", name: "文颜薄荷", description: "薄荷绿，适合健康、环保、自然", group: "wenyan" },
  { id: "wenyan-orange-heart", name: "文颜橙心", description: "温暖橙色，适合美食、旅行、生活", group: "wenyan" },
  { id: "wenyan-pie", name: "文颜派", description: "锐利现代，适合科技评论、深度分析", group: "wenyan" },
  { id: "wenyan-purple", name: "文颜紫色", description: "微紫点缀，适合文艺、设计", group: "wenyan" },
  { id: "wenyan-rainbow", name: "文颜彩虹", description: "多彩但不刺眼，适合多元内容", group: "wenyan" },
  { id: "shuimo-default", name: "中国水墨", description: "黑白灰 + 印章红，适合文化、历史、艺术", group: "shuimo" },
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
