/** Fixed style record. Every saved profile uses these fields and these choices. */

export interface StyleFieldSpec {
  key: string;
  label: string;
  choices: readonly string[];
}

export const STYLE_SCHEMA: StyleFieldSpec[] = [
  { key: "column", label: "栏目", choices: ["乾坤AI路书", "FDE日记", "AI外网"] },
  { key: "article_category", label: "类别", choices: ["AI", "技术", "中医诊所", "教育"] },
  { key: "tone", label: "语气", choices: ["轻松口语"] },
  { key: "target_reader", label: "读者", choices: ["大众读者"] },
  { key: "writing_style", label: "写法", choices: ["口语"] },
  { key: "paragraph_preference", label: "段落", choices: ["长短交替"] },
  { key: "heading_density", label: "小标题", choices: ["按需"] },
  { key: "title_style", label: "标题类型", choices: ["干货", "数字", "悬念", "情感", "对比", "故事", "反问"] },
  { key: "title_max_length", label: "标题字数", choices: ["25"] },
  { key: "target_word_count", label: "篇幅", choices: ["1800-2500"] },
  { key: "default_author", label: "署名", choices: ["乾坤AI容我懒"] },
  { key: "forbidden_words", label: "禁用词", choices: ["赋能、闭环"] },
  {
    key: "topic_direction",
    label: "选题",
    choices: ["工具怎么用、何时不用", "医问安做成这样的取舍", "外网刚发生的事和读者有什么关系"],
  },
];

const HOUSE = {
  tone: "轻松口语",
  target_reader: "大众读者",
  writing_style: "口语",
  paragraph_preference: "长短交替",
  heading_density: "按需",
  title_max_length: "25",
  target_word_count: "1800-2500",
  default_author: "乾坤AI容我懒",
  forbidden_words: "赋能、闭环",
} as const;

const COLUMN_BUNDLE = {
  lushu: {
    column: "乾坤AI路书",
    article_category: "技术",
    title_style: "干货",
    topic_direction: "工具怎么用、何时不用",
  },
  fde: {
    column: "FDE日记",
    article_category: "中医诊所",
    title_style: "故事",
    topic_direction: "医问安做成这样的取舍",
  },
  foreign: {
    column: "AI外网",
    article_category: "AI",
    title_style: "对比",
    topic_direction: "外网刚发生的事和读者有什么关系",
  },
} as const;

type ColumnId = keyof typeof COLUMN_BUNDLE;

export interface StylePreset {
  id: ColumnId;
  label: string;
  summary: string;
  fields: Record<string, string>;
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: "lushu", label: "乾坤AI路书", summary: "工具怎么用、何时不用", fields: styleProfileForColumn("lushu") },
  { id: "fde", label: "FDE日记", summary: "医问安做成这样的取舍", fields: styleProfileForColumn("fde") },
  { id: "foreign", label: "AI外网", summary: "外网刚发生的事和读者有什么关系", fields: styleProfileForColumn("foreign") },
];

const ALIASES: Record<string, ColumnId> = {
  乾坤AI路书: "lushu",
  路书: "lushu",
  lushu: "lushu",
  口语科普: "lushu",
  清单干货: "lushu",
  干货: "lushu",
  FDE日记: "fde",
  fde日记: "fde",
  fde: "fde",
  日记: "fde",
  故事随笔: "fde",
  AI外网: "foreign",
  外网: "foreign",
  foreign: "foreign",
  观点短评: "foreign",
};

const TOPIC_TO_COLUMN: Record<string, ColumnId> = {
  "工具怎么用、何时不用": "lushu",
  "医问安做成这样的取舍": "fde",
  "外网刚发生的事和读者有什么关系": "foreign",
};

const LABEL_TO_KEY = new Map(STYLE_SCHEMA.map((field) => [field.label, field.key]));

export function styleProfileForColumn(id: ColumnId): Record<string, string> {
  return { ...HOUSE, ...COLUMN_BUNDLE[id] };
}

export function stylePresetById(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((preset) => preset.id === id);
}

export function matchStylePreset(text: string): StylePreset | undefined {
  const key = text.trim().toLowerCase();
  const id = ALIASES[key] ?? ALIASES[text.trim()];
  return id ? stylePresetById(id) : undefined;
}

export function styleFieldByName(name: string): StyleFieldSpec | undefined {
  const token = name.trim();
  const key = LABEL_TO_KEY.get(token) ?? token.toLowerCase();
  return STYLE_SCHEMA.find((field) => field.key === key);
}

export function normalizeStyleValue(key: string, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (key === "column") {
    return matchStylePreset(value)?.fields.column ?? null;
  }
  if (key === "topic_direction") {
    return TOPIC_TO_COLUMN[value] ? value : null;
  }
  const field = STYLE_SCHEMA.find((item) => item.key === key);
  if (!field) return null;
  return field.choices.includes(value) ? value : null;
}

export function styleChoiceHint(field: StyleFieldSpec): string {
  return `${field.label}只能是：${field.choices.join("、")}`;
}

export function styleFormatGuide(): string {
  const lines = [
    "文风档案是固定格式。先选栏目，应用写入整张表。不能把字段写成别的句子。",
    styleChoiceHint(STYLE_SCHEMA[0]),
    styleChoiceHint(STYLE_SCHEMA.find((field) => field.key === "article_category")!),
    styleChoiceHint(STYLE_SCHEMA.find((field) => field.key === "title_style")!),
    "语气、读者、写法、段落、小标题、标题字数、篇幅、署名、禁用词、选题随栏目带出。",
    "",
    STYLE_PRESETS.map((preset) => `- ${preset.label}：${preset.summary}（/style setup ${preset.label}）`).join("\n"),
    "",
    "改一项：/style update 标题类型 故事",
    "改类别：/style update 类别 教育",
  ];
  return lines.join("\n");
}

export function stylePresetMenu(): string {
  return styleFormatGuide();
}

function clipSample(text: string): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > 400 ? `${value.slice(0, 400)}…` : value;
}

function columnIdFromFields(fields: Record<string, string> | undefined): ColumnId {
  const fromColumn = fields?.column ? matchStylePreset(fields.column)?.id : undefined;
  if (fromColumn) return fromColumn;
  const fromTopic = fields?.topic_direction ? TOPIC_TO_COLUMN[fields.topic_direction] : undefined;
  return fromTopic ?? "lushu";
}

function columnFromSample(sample: string): ColumnId {
  if (/医问安|诊所|代价|做成这样|这一周/.test(sample)) return "fde";
  if (/外网|来源|原话|国外|和读者/.test(sample)) return "foreign";
  return "lushu";
}

const MATERIAL_KEYS = ["material_home", "pull_dir", "ima_kb_id", "ima_folder_id", "source_urls"] as const;

/** Fills every standard field. Column choice resets 类别、标题类型、选题 unless the patch sets them. */
export function canonicalStyleProfile(
  current: Record<string, string> | undefined,
  patch: Record<string, string>,
): Record<string, string> {
  const columnChanged = patch.column != null
    && matchStylePreset(patch.column)?.id !== matchStylePreset(current?.column ?? "")?.id;
  const columnId = columnIdFromFields({ ...current, ...patch });
  const next = styleProfileForColumn(columnId);
  if (!columnChanged) {
    for (const key of ["article_category", "title_style"] as const) {
      const raw = patch[key] ?? current?.[key];
      const normalized = raw ? normalizeStyleValue(key, raw) : null;
      if (normalized) next[key] = normalized;
    }
  } else {
    for (const key of ["article_category", "title_style"] as const) {
      const raw = patch[key];
      const normalized = raw ? normalizeStyleValue(key, raw) : null;
      if (normalized) next[key] = normalized;
    }
  }
  const excerpt = patch.sample_excerpt ?? current?.sample_excerpt;
  if (excerpt?.trim()) next.sample_excerpt = clipSample(excerpt);
  for (const key of MATERIAL_KEYS) {
    const raw = patch[key] ?? current?.[key];
    if (raw?.trim()) next[key] = raw.trim();
  }
  return next;
}

export function organizeStyleSample(text: string): Record<string, string> {
  const sample = text.trim();
  return {
    ...styleProfileForColumn(columnFromSample(sample)),
    sample_excerpt: clipSample(sample),
  };
}

export interface StyleAssignmentResult {
  fields: Record<string, string>;
  errors: string[];
}

export function parseStyleAssignments(text: string): Record<string, string> {
  return parseStyleAssignmentResult(text).fields;
}

export function parseStyleAssignmentResult(text: string): StyleAssignmentResult {
  const fields: Record<string, string> = {};
  const errors: string[] = [];
  let sawAssignment = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\S+?)\s*[:=：]\s*(.+)$/);
    if (!match) continue;
    const field = styleFieldByName(match[1]);
    if (!field) continue;
    sawAssignment = true;
    const normalized = normalizeStyleValue(field.key, match[2]);
    if (!normalized) {
      errors.push(styleChoiceHint(field));
      continue;
    }
    fields[field.key] = normalized;
  }
  if (sawAssignment && Object.keys(fields).length === 0 && errors.length === 0) {
    errors.push("字段值不在标准格式里。");
  }
  return { fields, errors };
}

function materialHomeLabel(value: string | undefined): string {
  if (value === "dir" || value === "目录") return "目录";
  if (value === "ima" || value === "IMA") return "IMA";
  return "未填";
}

export function formatStyleCard(
  structured: Record<string, string> | null,
  meta?: { version?: number; createdAt?: string },
): string {
  const data = structured ?? {};
  const lines = [
    meta?.version != null ? `版本：v${meta.version}` : "版本：未建档",
    meta?.createdAt ? `写入时间：${meta.createdAt}` : "",
    ...STYLE_SCHEMA.map((field) => `${field.label}：${data[field.key]?.trim() || "未填"}`),
    `例文：${data.sample_excerpt?.trim() || "未填"}`,
    `素材去向：${materialHomeLabel(data.material_home)}`,
    `拉取目录：${data.pull_dir?.trim() || ".artifacts/content/pulls"}`,
    `IMA知识库：${data.ima_kb_id?.trim() || "未填"}`,
    `IMA文件夹：${data.ima_folder_id?.trim() || "未填"}`,
    `网址：${data.source_urls?.trim() || "未填"}`,
  ].filter(Boolean);
  return lines.join("\n");
}
