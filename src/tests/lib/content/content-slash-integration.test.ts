import { describe, expect, it } from "vitest";
import {
  isContentClipPaste,
  isContentTitlePickReply,
  isOutlineFolderCancelReply,
  isOutlineFolderConfirmReply,
  parseStyleAssignments,
  resolveContentSlashIntegration,
  resolveWritingMaterialContext,
  type ContentSlashStore,
} from "@/lib/content/content-slash-integration";
import type { ContentEntry, ContentProfile } from "@/types/content.type";

function memoryStore(): ContentSlashStore & { profiles: ContentProfile[]; entries: ContentEntry[] } {
  const profiles: ContentProfile[] = [];
  const entries: ContentEntry[] = [];
  return {
    profiles,
    entries,
    async latestProfile() {
      return profiles[profiles.length - 1] ?? null;
    },
    async appendProfile(structured) {
      const previous = profiles[profiles.length - 1];
      const profile: ContentProfile = {
        id: `p${profiles.length + 1}`,
        version: (previous?.version ?? 0) + 1,
        structured: { ...(previous?.structured ?? {}), ...structured },
        createdAt: Date.now(),
      };
      profiles.push(profile);
      return profile;
    },
    async createEntry(input) {
      const now = Date.now();
      const entry: ContentEntry = {
        id: `e${entries.length + 1}`,
        type: input.type,
        occurredAt: input.occurredAt ?? now,
        title: input.title ?? "",
        summary: input.summary ?? "",
        rawText: input.rawText,
        source: input.source ?? "manual",
        sourceRef: input.sourceRef,
        tags: input.tags ?? [],
        createdAt: now,
        updatedAt: now,
      };
      entries.unshift(entry);
      return entry;
    },
    async listEntries(opts) {
      return entries
        .filter((entry) => (opts?.type ? entry.type === opts.type : true))
        .filter((entry) => (opts?.since != null ? entry.occurredAt >= opts.since : true))
        .filter((entry) => {
          const query = opts?.query?.trim();
          if (!query) return true;
          const haystack = `${entry.title}\n${entry.summary}\n${entry.rawText ?? ""}\n${entry.sourceRef ?? ""}`;
          return haystack.includes(query);
        })
        .slice(0, opts?.limit ?? 50);
    },
  };
}

describe("content slash integration", () => {
  it("parses style setup lines", () => {
    expect(parseStyleAssignments("title_style: 干货\narticle_category：教育")).toEqual({
      title_style: "干货",
      article_category: "教育",
    });
    expect(parseStyleAssignments("tone: 更口语")).toEqual({});
  });

  it("writes a record before the agent replies", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration(
      { command: "record", args: "idea Cursor 多窗口的一个坑" },
      store,
    );
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].type).toBe("idea");
    expect(result?.prompt).toContain("content_entries");
    expect(result?.prompt).toContain("Cursor 多窗口的一个坑");
  });

  it("appends a style version instead of overwriting history", async () => {
    const store = memoryStore();
    await resolveContentSlashIntegration(
      { command: "style", args: "setup 乾坤AI路书" },
      store,
    );
    const rejected = await resolveContentSlashIntegration(
      { command: "style", args: "update 语气 更口语" },
      store,
    );
    expect(store.profiles).toHaveLength(1);
    expect(rejected?.prompt).toContain("轻松口语");
    const updated = await resolveContentSlashIntegration(
      { command: "style", args: "update 标题类型 故事" },
      store,
    );
    expect(store.profiles).toHaveLength(2);
    expect(store.profiles[1].version).toBe(2);
    expect(store.profiles[1].structured.column).toBe("乾坤AI路书");
    expect(store.profiles[1].structured.title_style).toBe("故事");
    expect(store.profiles[1].structured.tone).toBe("轻松口语");
    expect(updated?.prompt).toContain("v2");
  });

  it("searches saved entries", async () => {
    const store = memoryStore();
    await resolveContentSlashIntegration(
      { command: "record", args: "quote 少谈赋能" },
      store,
    );
    const result = await resolveContentSlashIntegration(
      { command: "search", args: "赋能" },
      store,
    );
    expect(result?.prompt).toContain("少谈赋能");
  });

  it("gives draft and continue the saved profile and recent notes", async () => {
    const store = memoryStore();
    await resolveContentSlashIntegration(
      { command: "style", args: "setup 乾坤AI路书" },
      store,
    );
    await resolveContentSlashIntegration(
      { command: "record", args: "idea 今天的一个切口" },
      store,
    );
    const material = await resolveWritingMaterialContext(store);
    expect(material).toContain("content_profiles");
    expect(material).toContain("口语");
    expect(material).toContain("今天的一个切口");
    expect(material).toContain("article.md");
  });

  it("offers style templates and does not save an empty profile", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration({ command: "style", args: "setup" }, store);
    expect(result?.prompt).toContain("乾坤AI路书");
    expect(result?.prompt).toContain("FDE日记");
    expect(result?.prompt).toContain("AI外网");
    expect(store.profiles).toHaveLength(0);
  });

  it("saves a chosen style template", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration(
      { command: "style", args: "setup 乾坤AI路书" },
      store,
    );
    expect(store.profiles[0].structured.column).toBe("乾坤AI路书");
    expect(store.profiles[0].structured.writing_style).toBe("口语");
    expect(store.profiles[0].structured.article_category).toBe("技术");
    expect(store.profiles[0].structured.topic_direction).toBe("工具怎么用、何时不用");
    expect(store.profiles[0].structured.default_author).toBe("乾坤AI容我懒");
    expect(store.profiles[0].structured.target_word_count).toBe("1800-2500");
    expect(result?.prompt).toContain("栏目：乾坤AI路书");
    expect(result?.prompt).toContain("乾坤AI路书");
  });

  it("organizes a pasted paragraph into a style profile", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration(
      {
        command: "style",
        args: "setup 医问安这周只留了一个决定：代价是少做一个功能。",
      },
      store,
    );
    expect(store.profiles[0].structured.column).toBe("FDE日记");
    expect(store.profiles[0].structured.sample_excerpt).toContain("少做一个功能");
    expect(store.profiles[0].structured.topic_direction).toBe("医问安做成这样的取舍");
    expect(store.profiles[0].structured.tone).toBe("轻松口语");
    expect(result?.prompt).toContain("固定格式");
  });

  it("stores the material home inside style", async () => {
    const store = memoryStore();
    const dir = await resolveContentSlashIntegration(
      { command: "style", args: "sources 目录 .artifacts/content/pulls" },
      store,
    );
    expect(store.profiles[0].structured.material_home).toBe("dir");
    expect(store.profiles[0].structured.pull_dir).toBe(".artifacts/content/pulls");
    expect(dir?.prompt).toContain("目录");

    const ima = await resolveContentSlashIntegration(
      { command: "style", args: "sources ima kb-1 folder-2" },
      store,
    );
    expect(store.profiles[1].structured.material_home).toBe("ima");
    expect(store.profiles[1].structured.ima_kb_id).toBe("kb-1");
    expect(store.profiles[1].structured.ima_folder_id).toBe("folder-2");
    expect(ima?.prompt).toContain("IMA");

    await resolveContentSlashIntegration(
      { command: "style", args: "sources add https://example.com/feed" },
      store,
    );
    const pull = await resolveContentSlashIntegration({ command: "pull", args: "" }, store);
    expect(pull?.prompt).toContain("IMA");
    expect(pull?.prompt).not.toContain("写到");
  });

  it("saves source urls and lists them for a pull", async () => {
    const store = memoryStore();
    await resolveContentSlashIntegration(
      { command: "sources", args: "add https://example.com/feed" },
      store,
    );
    const pull = await resolveContentSlashIntegration({ command: "pull", args: "" }, store);
    expect(store.profiles[0].structured.source_urls).toContain("https://example.com/feed");
    expect(store.entries.some((entry) => entry.type === "collect")).toBe(true);
    expect(pull?.prompt).toContain("https://example.com/feed");
    expect(pull?.prompt).toContain(".artifacts/content/pulls");
  });

  it("proposes topics without creating a draft", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration({ command: "propose", args: "" }, store);
    expect(result?.prompt).toContain("/propose");
    expect(result?.prompt).toContain("不要创建草稿目录");
    expect(result?.prompt).toContain("/outline");
    expect(store.entries).toHaveLength(0);
  });

  it("clips pasted text into the current article", async () => {
    const store = memoryStore();
    const pasted = "产品好做是因为脚手架太强，难的是让客户愿意付钱换掉旧习惯。";
    const result = await resolveContentSlashIntegration({ command: "clip", args: pasted }, store);
    expect(result?.prompt).toContain("整理进当前");
    expect(result?.prompt).toContain("必须尽量与主题一致");
    expect(result?.prompt).toContain(pasted);
    expect(store.entries.some((entry) => entry.type === "clip")).toBe(true);
  });

  it("asks outline to research then write a first draft, titles later", async () => {
    const store = memoryStore();
    const result = await resolveContentSlashIntegration(
      { command: "outline", args: "产品好做客户难" },
      store,
    );
    expect(result?.prompt).toContain("主题和标题分开");
    expect(result?.prompt).toContain("锁定主题");
    expect(result?.prompt).toContain("collect.py");
    expect(result?.prompt).toContain("1200–2000");
    expect(result?.prompt).toContain("[等待确认]");
    expect(result?.prompt).toContain("用户确认后才写锁定目录");
    expect(result?.prompt).not.toContain("标题尚未确认");
  });

  it("recognizes confirm or cancel before creating a draft folder", () => {
    expect(isOutlineFolderConfirmReply("确认")).toBe(true);
    expect(isOutlineFolderConfirmReply("好")).toBe(true);
    expect(isOutlineFolderCancelReply("取消")).toBe(true);
    expect(isOutlineFolderConfirmReply("今天天气不错")).toBe(false);
  });

  it("recognizes a title pick reply", () => {
    expect(isContentTitlePickReply("2")).toBe(true);
    expect(isContentTitlePickReply("标题：产品好做，客户难抢")).toBe(true);
    expect(isContentTitlePickReply("主题 1，标题 3")).toBe(true);
    expect(isContentTitlePickReply("今天天气不错")).toBe(false);
  });

  it("treats a long pasted paragraph as clip-into-article", () => {
    expect(isContentClipPaste("改第二段")).toBe(false);
    expect(
      isContentClipPaste("产品好做是因为脚手架太强，难的是让客户愿意付钱换掉旧习惯。"),
    ).toBe(true);
  });
});
