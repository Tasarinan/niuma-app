import { describe, expect, it } from "vitest";
import {
  classifyBufferSync,
  classifyDraftFile,
  pickOpenManuscriptContent,
  resolveDiskSyncAction,
  draftFolderFromFilePath,
  formatOpenDraftContext,
  injectOpenDraftContext,
  stripHiddenDraftContext,
  nextDraftImageFilename,
  formatDraftImagePromptMarkdown,
  pairDraftImagePrompts,
  parseImagePromptBlocks,
  parseImagePromptFile,
  promptMarkdownAbsPath,
  assembleDraftGalleryItems,
  sortDraftFiles,
} from "@/lib/artifact/draft-workspace";

describe("draft workspace", () => {
  it("finds the confirmed draft folder from an open file", () => {
    expect(
      draftFolderFromFilePath("C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/article.md"),
    ).toBe("C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由");
    expect(draftFolderFromFilePath("C:/niuma/.artifacts/drafts/foo/imgs/01.png")).toBe(
      "C:/niuma/.artifacts/drafts/foo",
    );
    expect(draftFolderFromFilePath("notes.md")).toBeNull();
    expect(
      draftFolderFromFilePath("\\\\?\\C:\\niuma\\.artifacts\\drafts\\foo\\article.md"),
    ).toBe("C:/niuma/.artifacts/drafts/foo");
  });

  it("applies agent disk writes when the human has not typed", () => {
    expect(
      classifyBufferSync({
        editorContent: "old",
        lastSavedContent: "old",
        diskContent: "agent",
      }),
    ).toBe("apply-disk");
  });

  it("keeps human typing when disk is unchanged", () => {
    expect(
      classifyBufferSync({
        editorContent: "mine",
        lastSavedContent: "old",
        diskContent: "old",
      }),
    ).toBe("human-dirty");
  });

  it("flags a conflict when both sides changed", () => {
    expect(
      classifyBufferSync({
        editorContent: "mine",
        lastSavedContent: "old",
        diskContent: "agent",
      }),
    ).toBe("conflict");
  });

  it("applies agent disk writes when the editor drifted without human typing", () => {
    expect(
      resolveDiskSyncAction({
        humanEdited: false,
        editorContent: "round-trip drift",
        lastSavedContent: "old",
        diskContent: "agent",
      }),
    ).toBe("apply-disk");
  });

  it("keeps human edits when both editor and disk changed", () => {
    expect(
      resolveDiskSyncAction({
        humanEdited: true,
        editorContent: "mine",
        lastSavedContent: "old",
        diskContent: "agent",
      }),
    ).toBe("conflict");
  });

  it("keeps unsaved editor text when reopening after a remount", () => {
    expect(
      pickOpenManuscriptContent({
        diskContent: "old disk",
        memoryContent: "typed in editor",
        lastSavedContent: "",
      }),
    ).toBe("typed in editor");
  });

  it("applies disk when the in-memory buffer is still the last saved text", () => {
    expect(
      pickOpenManuscriptContent({
        diskContent: "agent",
        memoryContent: "old",
        lastSavedContent: "old",
      }),
    ).toBe("agent");
  });

  it("orders article/topic/review before images", () => {
    expect(sortDraftFiles([{ name: "01.png" }, { name: "review.md" }, { name: "article.md" }]).map((f) => f.name)).toEqual([
      "article.md",
      "review.md",
      "01.png",
    ]);
    expect(classifyDraftFile("topic.md")).toBe("topic");
    expect(classifyDraftFile("HRSh1uMboAAPsIX.jfif")).toBe("image");
  });

  it("tells the agent the open file is the bound co-creation manuscript", () => {
    const text = formatOpenDraftContext("/niuma/.artifacts/drafts/foo/article.md");
    expect(text).toContain("[当前共创目录]");
    expect(text).toContain("/niuma/.artifacts/drafts/foo/article.md");
    expect(text).toContain("open_article");
  });

  it("injects the open file into agent input, not the visible bubble", () => {
    expect(injectOpenDraftContext("改第二段", {})).toBe("改第二段");
    const draft = "C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/article.md";
    const leftover = String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`;
    expect(injectOpenDraftContext("改第二段", { openFilePath: leftover })).toBe("改第二段");
    const injected = injectOpenDraftContext("改第二段", {
      openFilePath: leftover,
      lastOpenPath: draft,
    });
    expect(injected.startsWith("改第二段")).toBe(true);
    expect(injected).toContain("[当前共创目录]");
    expect(injected).toContain(draft);
    expect(injected).not.toContain("untitled-article.md");
    expect(stripHiddenDraftContext(injected)).toBe("改第二段");
  });

  it("parses reference prompts and picks the next image filename", () => {
    const blocks = parseImagePromptBlocks(`
## 封面（cover.png）

**中文提示词**：
左右对比构图，无文字

**输出尺寸**：1080x600

## 图1：三段案例

**风格关键词**：
infographic, three cards
`);
    expect(blocks).toEqual([
      { title: "封面", filename: "cover.png", prompt: "左右对比构图，无文字" },
      { title: "图1：三段案例", filename: undefined, prompt: "infographic, three cards" },
    ]);
    expect(nextDraftImageFilename([])).toBe("01.png");
    expect(nextDraftImageFilename([], { intent: "cover" })).toBe("cover.png");
    expect(nextDraftImageFilename(["cover.png", "01.png"])).toBe("02.png");
  });

  it("pairs one prompt file to the same-named png, not by gallery order", () => {
    const combinedDump = `
## 封面（cover.png）

**中文提示词**：
左右对比

## 图1：三段案例

**中文提示词**：
三张卡片

## 图2：自我反思

**中文提示词**：
孤独开发者
`;
    const paired = pairDraftImagePrompts(
      ["cover.png", "01.png", "HRSh1uMboAAPsIX.png"],
      [
        { name: "cover.md", markdown: "## 封面（cover.png）\n\n**中文提示词**：\n左右对比\n" },
        { name: "01.md", markdown: "## 图1：三段案例\n\n**中文提示词**：\n三张卡片\n" },
        { name: "backup.md", markdown: combinedDump },
      ],
    );
    expect(paired.byImage.get("cover.png")?.prompt).toBe("左右对比");
    expect(paired.byImage.get("01.png")?.prompt).toBe("三张卡片");
    expect(paired.byImage.get("HRSh1uMboAAPsIX.png")).toBeUndefined();
    expect(paired.unmatched.map((item) => item.filename)).toEqual([]);
    expect(parseImagePromptFile(combinedDump, "01.md")).toBeNull();
    expect(parseImagePromptFile(
      formatDraftImagePromptMarkdown({ title: "封面", filename: "cover.png", prompt: "左右对比" }),
      "cover.md",
    )).toEqual({ title: "封面", filename: "cover.png", prompt: "左右对比" });
    expect(promptMarkdownAbsPath("C:/niuma/.artifacts/drafts/foo/imgs/cover.png")).toBe(
      "C:/niuma/.artifacts/drafts/foo/imgs/prompts/cover.md",
    );
    expect(formatDraftImagePromptMarkdown({
      title: "封面",
      filename: "cover.png",
      prompt: "左右对比",
    })).toContain("**中文提示词**：");
    expect(formatDraftImagePromptMarkdown({
      title: "封面",
      filename: "cover.png",
      prompt: "网上搜到的白板",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:W.png",
    })).toContain("**来源**：");
  });

  it("parses a one-file H1 prompt like imgs/prompts/封面.md", () => {
    const parsed = parseImagePromptFile(
      "# 封面（封面.png）\n\n**中文提示词**：\n一个人坐在书桌前，面前有多个发光的AI助手\n",
      "封面.md",
    );
    expect(parsed).toEqual({
      title: "封面",
      filename: "封面.png",
      prompt: "一个人坐在书桌前，面前有多个发光的AI助手",
    });
    const paired = pairDraftImagePrompts(
      ["封面.png", "Screenshot 2026-09-07 112646.png"],
      [{ name: "封面.md", markdown: "# 封面（封面.png）\n\n**中文提示词**：\n书房暖光\n" }],
    );
    expect(paired.byImage.get("封面.png")?.prompt).toBe("书房暖光");
    expect(paired.unmatched).toEqual([]);
  });

  it("lists every image under the draft folder and shows its prompt", () => {
    const items = assembleDraftGalleryItems({
      images: [
        {
          name: "Screenshot 2026-09-07 112646.png",
          path: "/d/Screenshot 2026-09-07 112646.png",
          relativeSrc: "Screenshot 2026-09-07 112646.png",
        },
        {
          name: "封面.png",
          path: "/d/imgs/封面.png",
          relativeSrc: "imgs/封面.png",
        },
      ],
      promptDocs: [
        {
          name: "封面.md",
          markdown: "# 封面（封面.png）\n\n**中文提示词**：\n书房暖光\n",
        },
        {
          name: "02.md",
          markdown: "# 配图2（02.png）\n\n**中文提示词**：\n尚未出图\n",
        },
      ],
    });
    expect(items.map((item) => item.relativeSrc)).toEqual([
      "imgs/封面.png",
      "imgs/02.png",
      "Screenshot 2026-09-07 112646.png",
    ]);
    expect(items.find((item) => item.name === "封面.png")?.prompt).toBe("书房暖光");
    expect(items.find((item) => item.relativeSrc === "imgs/02.png")?.prompt).toBe("尚未出图");
    expect(items.find((item) => item.name.startsWith("Screenshot"))?.prompt).toBe("");
  });
});
