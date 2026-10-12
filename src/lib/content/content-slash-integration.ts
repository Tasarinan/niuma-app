import {
  appendContentProfile,
  createContentEntry,
  latestContentProfile,
  listContentEntries,
} from "@/lib/database/content.action";
import type { ContentEntry, ContentEntryType, ContentProfile } from "@/types/content.type";
import {
  canonicalStyleProfile,
  formatStyleCard,
  matchStylePreset,
  organizeStyleSample,
  parseStyleAssignmentResult,
  styleChoiceHint,
  styleFieldByName,
  styleFormatGuide,
  STYLE_PRESETS,
  STYLE_SCHEMA,
} from "@/lib/content/style-presets";

export { parseStyleAssignments } from "@/lib/content/style-presets";

export interface ContentSlashContext {
  command: string;
  args: string;
}

export interface ContentSlashResolution {
  prompt: string;
}

export interface ContentSlashStore {
  createEntry: typeof createContentEntry;
  listEntries: typeof listContentEntries;
  latestProfile: typeof latestContentProfile;
  appendProfile: typeof appendContentProfile;
  /** Present in the app. Tests omit it so records stay local. */
  pushToIma?: (entry: ContentEntry) => Promise<string>;
}

const RECORD_TYPES = new Set<ContentEntryType>(["idea", "note", "clip", "quote", "diary"]);

export const CONTENT_STYLE_FIELDS = STYLE_SCHEMA.map((field) => field.key);

export const CONTENT_SOURCE_FIELDS = [
  "source_urls",
  "pull_dir",
  "ima_kb_id",
  "ima_folder_id",
] as const;

export const DEFAULT_PULL_DIR = ".artifacts/content/pulls";

const defaultStore: ContentSlashStore = {
  createEntry: createContentEntry,
  listEntries: listContentEntries,
  latestProfile: latestContentProfile,
  appendProfile: appendContentProfile,
  pushToIma: pushRecordToIma,
};

function day(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

function clip(text: string, max = 80): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatProfile(profile: ContentProfile | null): string {
  if (!profile) {
    return ["尚无文风档案。写稿暂用 `.teams/content/editor/editorial.yaml`。", formatStyleCard(null)].join("\n");
  }
  return formatStyleCard(profile.structured, {
    version: profile.version,
    createdAt: day(profile.createdAt),
  });
}

function formatEntry(entry: ContentEntry): string {
  const ref = entry.sourceRef ? ` | ${entry.sourceRef}` : "";
  return `- ${day(entry.occurredAt)} | ${entry.type} | ${entry.summary || entry.title}${ref}`;
}

async function handleRecord(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const [typeToken = "", ...rest] = args.trim().split(/\s+/);
  const type = typeToken.toLowerCase() as ContentEntryType;
  const body = rest.join(" ").trim();
  if (!RECORD_TYPES.has(type)) {
    return {
      prompt:
        "用户执行了 /record，但类型无效。请提示使用 idea、note、clip、quote、diary，例如：/record idea 今天想记的一句。",
    };
  }
  if (!body) {
    return {
      prompt: `用户执行了 /record ${type} 但没有正文。请提示补充内容，不要写入空记录。`,
    };
  }
  const entry = await store.createEntry({
    type,
    title: type,
    summary: clip(body),
    rawText: body,
    source: "manual",
  });
  let imaNote = "未配置 IMA 同步。本地记录已保存。用 /sources ima <知识库ID> <文件夹ID> 指定地址。";
  if (store.pushToIma) {
    try {
      imaNote = await store.pushToIma(entry);
    } catch (error) {
      imaNote = `本地已保存。IMA 未写入：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return {
    prompt: [
      `用户通过 /record ${type} 写入了 content_entries，数据库已保存。`,
      "",
      formatEntry(entry),
      `- id: ${entry.id}`,
      `- IMA: ${imaNote}`,
      "",
      "请用中文简短确认。不要再写 journal 文件；正文以这条数据库记录为准。",
    ].join("\n"),
  };
}

async function handleStyle(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const [action = "view", ...rest] = args.trim().split(/\s+/);
  const normalized = action.toLowerCase();
  const tail = rest.join(" ").trim();

  if (normalized === "view" || !normalized) {
    const profile = await store.latestProfile();
    return {
      prompt: [
        "用户执行 /style view。当前个人文风（content_profiles 最新版本）：",
        formatProfile(profile),
        "",
        "素材去向：",
        formatSources(profile),
        "",
        "请用中文简短展示。有档案时写稿以它为准，否则用 editorial.yaml。素材放目录还是 IMA，用 /style sources。",
      ].join("\n"),
    };
  }

  if (normalized === "update") {
    const [field = "", ...valueParts] = tail.split(/\s+/);
    const spec = styleFieldByName(field);
    const value = valueParts.join(" ").trim();
    if (!spec || !value) {
      return {
        prompt: [
          "用户执行了 /style update，但字段或值不在标准格式里。",
          styleFormatGuide(),
          "示例：/style update 标题类型 故事",
        ].join("\n"),
      };
    }
    const canonical = spec.key === "column" || spec.key === "topic_direction"
      ? (matchStylePreset(value)?.fields[spec.key] ?? (spec.choices.includes(value) ? value : null))
      : spec.choices.includes(value) ? value : null;
    if (!canonical) {
      return {
        prompt: `用户执行了 /style update，值不能写入。${styleChoiceHint(spec)}。不要保存这份修改。`,
      };
    }
    const previous = await store.latestProfile();
    const columnFromTopic = spec.key === "topic_direction"
      ? STYLE_PRESETS.find((preset) => preset.fields.topic_direction === canonical)
      : undefined;
    const patch = spec.key === "column" || columnFromTopic
      ? { column: columnFromTopic?.label ?? canonical }
      : { [spec.key]: canonical };
    const profile = await store.appendProfile(canonicalStyleProfile(previous?.structured, patch));
    return {
      prompt: [
        `用户通过 /style update 追加了文风版本 v${profile.version}，已按固定格式写入 content_profiles。`,
        formatProfile(profile),
        "",
        "请按上面的固定字段简短确认。不要改 editorial.yaml，也不要另写 style.yaml。",
      ].join("\n"),
    };
  }

  if (normalized === "setup" || matchStylePreset(normalized)) {
    const body = normalized === "setup" ? tail : [normalized, tail].filter(Boolean).join(" ");
    const presetName = body.split(/\s+/)[0] ?? "";
    const preset = matchStylePreset(body) ?? matchStylePreset(presetName);
    const remainder = preset && presetName && matchStylePreset(presetName)
      ? body.slice(presetName.length).trim()
      : body;
    if (!body) {
      return {
        prompt: [
          "用户执行 /style setup，还没有选择栏目。请用中文展示下面的固定格式，请用户选一个栏目，或贴一段文字。",
          "不要让用户自造字段句子。",
          "",
          styleFormatGuide(),
        ].join("\n"),
      };
    }
    const assignment = parseStyleAssignmentResult(body);
    if (assignment.errors.length > 0) {
      return {
        prompt: [
          "用户执行了 /style setup，但填写不符合固定格式，没有写入。",
          assignment.errors.join("\n"),
          "",
          styleFormatGuide(),
        ].join("\n"),
      };
    }
    const previous = await store.latestProfile();
    const structured = Object.keys(assignment.fields).length > 0
      ? canonicalStyleProfile(previous?.structured, assignment.fields)
      : preset
        ? canonicalStyleProfile(previous?.structured, {
            ...preset.fields,
            ...(remainder ? { sample_excerpt: remainder } : {}),
          })
        : canonicalStyleProfile(previous?.structured, organizeStyleSample(body));
    const profile = await store.appendProfile(structured);
    const how = Object.keys(assignment.fields).length > 0
      ? "按固定字段"
      : preset
        ? `选用栏目「${preset.label}」`
        : "按贴上的文字归入栏目";
    return {
      prompt: [
        `用户通过 /style setup ${how}，已按固定格式写入文风版本 v${profile.version}。`,
        formatProfile(profile),
        "",
        "请按上面的固定字段简短确认。要换栏目，重新 /style setup 选乾坤AI路书、FDE日记或 AI外网。素材放哪里用 /style sources 目录 或 /style sources ima。",
      ].join("\n"),
    };
  }

  if (normalized === "sources" || normalized === "source") {
    return handleSources(tail || "view", store);
  }

  return {
    prompt: "用户执行了 /style。请引导使用 setup、view，或 /style sources 选择素材放目录还是 IMA。",
  };
}

async function handleCollect(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const [kind = "", ...rest] = args.trim().split(/\s+/);
  const body = rest.join(" ").trim();
  const normalized = kind.toLowerCase();
  if (normalized === "url") {
    const url = rest[0]?.trim() ?? "";
    if (!url) {
      return { prompt: "用户执行了 /collect url 但没有链接。请提示补充 URL。" };
    }
    const note = rest.slice(1).join(" ").trim();
    const entry = await store.createEntry({
      type: "collect",
      title: "剪藏",
      summary: clip(note || url),
      rawText: note || url,
      source: "url",
      sourceRef: url,
    });
    return {
      prompt: [
        "用户通过 /collect url 写入了剪藏条目。",
        formatEntry(entry),
        `- id: ${entry.id}`,
        "",
        "数据库已保存链接。若需要全文，再抓取页面并把摘要补进回复；不要另建 journal 文件作为主记录。",
      ].join("\n"),
    };
  }
  if (!body && normalized !== "file") {
    return { prompt: "用户执行了 /collect。请使用 /collect url <链接> 或 /collect file <说明>。" };
  }
  const entry = await store.createEntry({
    type: "collect",
    title: "剪藏",
    summary: clip(body || "附件"),
    rawText: body || undefined,
    source: "file",
  });
  return {
    prompt: [
      "用户通过 /collect file 写入了剪藏条目。",
      formatEntry(entry),
      `- id: ${entry.id}`,
      "",
      "请简短确认。附件若在对话里，可继续摘要；主记录已在 content_entries。",
    ].join("\n"),
  };
}

async function handleDigest(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const range = (args.trim().split(/\s+/)[0] || "week").toLowerCase();
  const days = range === "month" ? 30 : 7;
  const since = Date.now() - days * 24 * 3600 * 1000;
  const entries = await store.listEntries({ since, limit: 200 });
  const counts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.type] = (acc[entry.type] ?? 0) + 1;
    return acc;
  }, {});
  return {
    prompt: [
      `用户执行 /digest ${range === "month" ? "month" : "week"}。以下是 content_entries 统计，不要自动创建草稿目录。`,
      `- 范围: 近 ${days} 天`,
      `- 条数: ${entries.length}`,
      `- 类型: ${JSON.stringify(counts)}`,
      "",
      "最近记录：",
      entries.slice(0, 15).map(formatEntry).join("\n") || "- 暂无",
      "",
      "请输出一份列表报：每条一行，包含日期、类型、摘要、来源。然后最多给 3 个可成稿题目。不要自动建草稿目录；等用户选定后再 /outline。",
    ].join("\n"),
  };
}

async function handleSearch(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const query = args.trim();
  if (!query) {
    return { prompt: "用户执行了 /search 但没有关键词。请提示补充要搜的内容。" };
  }
  const entries = await store.listEntries({ query, limit: 20 });
  return {
    prompt: [
      `用户执行 /search ${query}。以下是 content_entries 匹配结果。`,
      entries.map(formatEntry).join("\n") || "- 没有匹配的素材",
      "",
      "请用中文列出结果。草稿目录与 IMA 仍可另行检索，但日更与文风素材以数据库为准。",
    ].join("\n"),
  };
}

/** Profile plus recent notes for /outline and editor assist. Does not write. */
function listedUrls(raw: string | undefined): string[] {
  if (!raw) return [];
  const found = raw.match(/https?:\/\/[^\s,，]+/gi) ?? [];
  return [...new Set(found.map((url) => url.replace(/[)\].,，。]+$/g, "")))];
}

function materialHome(profile: ContentProfile | null): "dir" | "ima" | "" {
  const value = profile?.structured.material_home?.trim().toLowerCase();
  if (value === "ima") return "ima";
  if (value === "dir" || value === "目录") return "dir";
  return "";
}

function formatSources(profile: ContentProfile | null): string {
  if (!profile) return "- 尚未保存素材去向。用 /style sources 目录 或 /style sources ima。";
  const urls = listedUrls(profile.structured.source_urls);
  const home = materialHome(profile);
  return [
    `- 素材去向: ${home === "ima" ? "IMA" : home === "dir" ? "目录" : "未指定（思考默认进 IMA，拉取默认进目录）"}`,
    `- 拉取目录: ${profile.structured.pull_dir || DEFAULT_PULL_DIR}`,
    `- IMA 知识库: ${profile.structured.ima_kb_id || "（未指定，沿用应用里的文章资产）"}`,
    `- IMA 文件夹: ${profile.structured.ima_folder_id || "（未指定，思考默认进蜜粉）"}`,
    urls.length ? urls.map((url) => `- ${url}`).join("\n") : "- 尚未添加网址",
  ].join("\n");
}

async function handleSources(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const [action = "view", ...rest] = args.trim().split(/\s+/);
  const normalized = action.toLowerCase();
  const profile = await store.latestProfile();
  const current = listedUrls(profile?.structured.source_urls);

  if (normalized === "add") {
    const urls = listedUrls(rest.join(" "));
    if (urls.length === 0) {
      return { prompt: "用户执行了 /style sources add 但没有 http(s) 网址。请提示补上要每天拉取的链接。" };
    }
    const saved = await store.appendProfile({ source_urls: [...current, ...urls].filter((url, index, all) => all.indexOf(url) === index).join("\n") });
    return {
      prompt: [
        `用户通过 /style sources add 写入了网址，文风档案版本 v${saved.version}。`,
        formatSources(saved),
        "",
        "请简短确认。这些网址供 /pull 使用。",
      ].join("\n"),
    };
  }

  if (normalized === "remove") {
    const urls = listedUrls(rest.join(" "));
    const next = current.filter((url) => !urls.includes(url));
    const saved = await store.appendProfile({ source_urls: next.join("\n") });
    return {
      prompt: [`用户通过 /style sources remove 更新了网址列表，版本 v${saved.version}。`, formatSources(saved), "", "请简短确认。"].join("\n"),
    };
  }

  if (normalized === "dir" || normalized === "目录" || normalized === "folder") {
    const dir = rest.join(" ").trim();
    const saved = await store.appendProfile({
      material_home: "dir",
      ...(dir ? { pull_dir: dir } : {}),
    });
    return {
      prompt: [
        `用户把素材去向设为目录，版本 v${saved.version}。`,
        formatSources(saved),
        "",
        "请简短确认。之后 /pull 写入该目录，/record 只留在本地。",
      ].join("\n"),
    };
  }

  if (normalized === "ima") {
    const [kb = "", folder = ""] = rest;
    const saved = await store.appendProfile({
      material_home: "ima",
      ...(kb ? { ima_kb_id: kb } : {}),
      ...(folder ? { ima_folder_id: folder } : {}),
    });
    return {
      prompt: [
        `用户把素材去向设为 IMA，版本 v${saved.version}。`,
        formatSources(saved),
        "",
        "请简短确认。之后 /record 写入这个知识库；未填 ID 时沿用应用里的文章资产。/pull 的网址列表也会记入 IMA。",
      ].join("\n"),
    };
  }

  return {
    prompt: [
      "用户在查看文风里的素材去向。",
      formatSources(profile),
      "",
      "请用中文列出。选目录：/style sources 目录。选 IMA：/style sources ima。添加网址：/style sources add https://…",
    ].join("\n"),
  };
}

async function handlePull(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const profile = await store.latestProfile();
  const urls = [...listedUrls(profile?.structured.source_urls), ...listedUrls(args)];
  const unique = urls.filter((url, index, all) => all.indexOf(url) === index);
  if (unique.length === 0) {
    return { prompt: "用户执行了 /pull，但还没有网址。请提示先 /style sources add https://…" };
  }
  const dayStamp = new Date().toISOString().slice(0, 10);
  const dir = `${(profile?.structured.pull_dir || DEFAULT_PULL_DIR).replace(/\\/g, "/").replace(/\/$/, "")}/${dayStamp}`;
  const entry = await store.createEntry({
    type: "collect",
    title: `拉取 ${dayStamp}`,
    summary: `${unique.length} 个网址`,
    rawText: unique.join("\n"),
    source: "url",
    sourceRef: unique[0],
  });
  const home = materialHome(profile);
  if (home === "ima") {
    const imaNote = store.pushToIma ? await store.pushToIma(entry) : "文风指定放 IMA，但这次没有执行写入。";
    return {
      prompt: [
        `用户执行 /pull。文风指定素材放在 IMA。这次拉取已记入 content_entries（${entry.id}）。`,
        imaNote,
        "请在回复里给出列表报：标题、网址、一句摘要。不要把正文另存到本地拉取目录。",
        "打不开的页面直接写进列表，不要编造正文。",
        "",
        unique.map((url) => `- ${url}`).join("\n"),
      ].join("\n"),
    };
  }
  return {
    prompt: [
      `用户执行 /pull。这次拉取已记入 content_entries（${entry.id}）。素材去向是目录。`,
      `请把每个网址收成一篇 Markdown，写到 \`${dir}/\` 下，文件名用短英文 slug，文首写原来的 URL。`,
      "打不开的页面直接写进列表，不要编造正文。",
      "",
      unique.map((url) => `- ${url}`).join("\n"),
      "",
      "写完后用中文给一份列表报：标题、网址、一句摘要、本地路径。",
    ].join("\n"),
  };
}

async function handlePropose(store: ContentSlashStore): Promise<ContentSlashResolution> {
  const profile = await store.latestProfile();
  const entries = await store.listEntries({ limit: 30 });
  return {
    prompt: [
      "用户执行 /propose。根据文风、日更和已拉取的素材，提出写作主题。不要创建草稿目录，不要写 article.md。",
      "",
      "个人文风：",
      formatProfile(profile),
      "",
      "网址与 IMA：",
      formatSources(profile),
      "",
      "近期素材：",
      entries.map(formatEntry).join("\n") || "- 暂无",
      "",
      "给出最多 5 个主题。每个主题包含：题目、为什么现在写、引用了哪些记录 id 或网址。不定最终标题。本地不够或用户有新想法时请用户 /outline，不要假装搜过网。停在这里等用户选定后 /outline 写初稿。",
    ].join("\n"),
  };
}

export function isOutlineFolderConfirmReply(text: string): boolean {
  const value = text.trim();
  if (!value || value.startsWith("/")) return false;
  return /^(确认|好的?|可以|行|建吧|创建(?:目录|文件夹)?吧?|用这个|就这个|ok|yes|y)$/i.test(value);
}

export function isOutlineFolderCancelReply(text: string): boolean {
  const value = text.trim();
  if (!value || value.startsWith("/")) return false;
  return /^(取消|不建|不要|算了|不用)$/.test(value);
}

export function isContentTitlePickReply(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/^(?:选|用|要)?(?:第)?[1-5](?:个|号|题)?(?:标题)?$/.test(value)) return true;
  if (/^[1-5][.、)）]\s*\S+/.test(value)) return true;
  if (/^标题\s*[：:]\s*\S+/.test(value)) return true;
  if (/^用这个标题/.test(value)) return true;
  if (/^主题\s*[1-5].*标题/.test(value)) return true;
  return false;
}

export function titlePickContinuationPrompt(): string {
  return [
    "用户正在改标题，不是改主题。",
    "主题以 topic.md 为准，不要改。",
    "若磁盘上已有 article.md：只改 H1 和 article.yaml 的标题，不要重写正文。",
    "若还没有初稿：不要卡在选标题。先定主题、再写初稿，标题按正文后改。",
    "不要编造亲身经历。",
  ].join("\n");
}

export function isContentClipPaste(text: string): boolean {
  const value = text.trim();
  if (!value || value.startsWith("/")) return false;
  if (isContentTitlePickReply(value)) return false;
  if (value.length < 24) return false;
  return value.length >= 80 || /[。！？\n]/.test(value);
}

export function clipIntoArticlePrompt(raw: string): string {
  return [
    "用户从外面拷来一段话，想整理进当前文章。主题和标题不是一回事。",
    "先 read topic.md 里已锁定的主题，再 read 当前 article.md。",
    "材料必须尽量与主题一致才用。不贴题：说明为什么不用，不要硬塞，不要为了这段话改主题。",
    "贴题：用文章自己的语气改写进合适小节。用户没说「引用」就不要整段粘贴。",
    "别人的观点注明来源或标「待核」。不要编成用户的亲身经历。",
    "不要这时改标题。标题按写成的内容后续再改。",
    "没有当前稿时说明先 /outline 开一篇，不要新建第二个主题。",
    "改完 open_article。",
    "",
    "原文：",
    raw.trim(),
  ].join("\n");
}

async function handleClip(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const body = args.trim();
  if (!body) {
    return { prompt: "用户执行了 /clip 但没有正文。请提示直接粘贴要写进文章的那段话。" };
  }
  const entry = await store.createEntry({
    type: "clip",
    title: "clip",
    summary: clip(body),
    rawText: body,
    source: "manual",
  });
  return {
    prompt: [
      `用户通过 /clip 写入了 content_entries（id: ${entry.id}），同时要整理进当前 article.md。`,
      clipIntoArticlePrompt(body),
    ].join("\n"),
  };
}

async function handleOutline(args: string, store: ContentSlashStore): Promise<ContentSlashResolution> {
  const topic = args.trim();
  if (!topic) {
    return { prompt: "用户执行了 /outline 但没有想法。请提示 /outline <想法>。" };
  }
  const profile = await store.latestProfile();
  const retitleOnly = isContentTitlePickReply(topic);
  return {
    prompt: [
      `用户指定想法并要求写初稿：${topic}`,
      retitleOnly
        ? "这是改标题，不是改主题。若已有 article.md，只改 H1 和 article.yaml，不要改 topic.md 的主题，不要重写正文。"
        : [
            "主题和标题分开。先用一句话锁定主题，写入 topic.md，后面材料都要贴这个主题。",
            "不要先选最终标题。标题按写成的内容后续再改。",
            "若还没有 research.md：加载 topic-research（本地素材 → collect.py → web_search → web-to-markdown）。跑题材料丢掉。",
            "聊天里先讲写法和各节要解决什么，废水套话列入禁用。",
            "若对话里有 [等待确认]，本回合只问要不要新建该目录，禁止调研、禁止 write、禁止 mkdir。用户确认后才写锁定目录。",
            "目录已锁定时：只写那一个文件夹。同一主题当天不会有第二个；不要 mkdir，不要按很难/难另开目录。",
            "写 article.md 初稿：可读段落，约 1200–2000 字，不要空小节。H1 可用工作标题（可暂用主题原句）。",
            "缺的亲身事实标「待补」。有来源才写数字。",
            "open_article 定位 article.md。初稿后可给标题候选，改标题不改主题。",
          ].join(" "),
      "不要编造亲身经历。若文风里有 IMA 地址，在 topic.md 注明这些引用也可以在该知识库里找到。",
      "",
      "个人文风：",
      formatProfile(profile),
      "",
      "网址与 IMA：",
      formatSources(profile),
    ].join("\n"),
  };
}

async function pushRecordToIma(entry: ContentEntry): Promise<string> {
  const { importMarkdownToFeiniao } = await import("@/lib/functions/ima.api");
  const { getImaKbConfig } = await import("@/lib/storage/ima.storage");
  const profile = await latestContentProfile();
  if (profile?.structured.material_home === "dir") {
    return "本地已保存。文风指定素材放在目录，不写入 IMA。";
  }
  const config = getImaKbConfig();
  const kbId = profile?.structured.ima_kb_id || config.kbId;
  const folderId = profile?.structured.ima_folder_id || config.mifenFolderId;
  if (!kbId) return "本地已保存。尚未配置 IMA 知识库。";
  const result = await importMarkdownToFeiniao(
    entry.summary || entry.title || entry.type,
    entry.rawText || entry.summary,
    kbId,
    folderId || undefined,
  );
  if (!result.success) return `本地已保存。IMA 未写入：${result.error ?? "未知错误"}`;
  return `已写入 IMA 文件夹 ${folderId || "知识库根"}，笔记 ${result.id ?? ""}`.trim();
}

export async function resolveWritingMaterialContext(
  store: ContentSlashStore = defaultStore,
): Promise<string> {
  const profile = await store.latestProfile();
  const since = Date.now() - 14 * 24 * 3600 * 1000;
  const entries = await store.listEntries({ since, limit: 12 });
  return [
    "[Content DB Integration Context]",
    "写稿以 content_profiles 最新版本为准。没有档案时再用团队 editorial.yaml。",
    "素材来自 content_entries。不要读 style.yaml，也不要读 journal 文件。",
    "",
    "个人文风：",
    formatProfile(profile),
    "",
    "近 14 天素材：",
    entries.map(formatEntry).join("\n") || "- 暂无",
    "",
    "正文以磁盘 article.md 为准：先 read，再改用户点名的段落。不要用聊天记忆整篇覆盖。",
  ].join("\n");
}

export async function resolveContentSlashIntegration(
  ctx: ContentSlashContext,
  store: ContentSlashStore = defaultStore,
): Promise<ContentSlashResolution | null> {
  const command = ctx.command.trim().toLowerCase();
  if (command === "record") return handleRecord(ctx.args, store);
  if (command === "style") return handleStyle(ctx.args, store);
  if (command === "collect") return handleCollect(ctx.args, store);
  if (command === "digest") return handleDigest(ctx.args, store);
  if (command === "search") return handleSearch(ctx.args, store);
  if (command === "sources") return handleSources(ctx.args, store);
  if (command === "pull") return handlePull(ctx.args, store);
  if (command === "propose") return handlePropose(store);
  if (command === "clip") return handleClip(ctx.args, store);
  if (command === "outline") return handleOutline(ctx.args, store);
  return null;
}
