import { describe, expect, it } from "vitest";
import {
  assistSeatForKind,
  assistTeamAgentFile,
  editorAssistMessages,
  extractImagePrompt,
  isWholeArticleSelection,
  pickAssistAgent,
  pickAssistTeamAgent,
  preferredAssistAgentName,
  resolveAssistRange,
  unwrapAssistText,
} from "@/lib/content/editor-assist";
import { explainAssistProviderError } from "@/lib/content/editor-assist-run";

describe("editor assist", () => {
  it("asks for a replacement of the selected passage", () => {
    const { user } = editorAssistMessages({
      kind: "edit",
      target: "原来的一段",
      document: "全文",
      instruction: "更短",
    });
    expect(user).toContain("原来的一段");
    expect(user).toContain("更短");
    expect(user).toContain("只返回替换后的 Markdown");
  });

  it("reviews the whole manuscript without asking for a rewrite", () => {
    const { user } = editorAssistMessages({
      kind: "review-document",
      target: "",
      document: "整篇正文",
      instruction: "",
    });
    expect(user).toContain("整篇正文");
    expect(user).toContain("不要输出改写稿");
  });

  it("maps bubble seats to .teams/content/agents files", () => {
    expect(assistTeamAgentFile("edit")).toBe("writer.md");
    expect(assistTeamAgentFile("continue")).toBe("writer.md");
    expect(assistTeamAgentFile("review-document")).toBe("chief.md");
    expect(assistTeamAgentFile("image")).toBe("illustrator.md");
    expect(assistTeamAgentFile("format-selection")).toBe("publisher.md");
    expect(
      pickAssistTeamAgent(
        [
          { file: "writer.md", name: "写手", sourcePath: "C:/repo/.teams/content/agents/writer.md" },
          { file: "chief.md", name: "主编", sourcePath: "C:/repo/.teams/content/agents/chief.md" },
          { file: "writer.md", name: "旧写手", sourcePath: "C:/repo/.teams/study/agents/writer.md" },
        ],
        "edit",
        { teamId: "content", names: { writerName: "旧写手" } },
      )?.sourcePath,
    ).toContain("/content/agents/writer.md");
  });

  it("explains a missing API key instead of niuma-direct", () => {
    expect(explainAssistProviderError("No API key (niuma-direct)")).toContain("API Key");
    expect(explainAssistProviderError("No API key (niuma-direct)")).toContain(".teams");
  });

  it("uses the hired writer as the default editor-assist seat", () => {
    const names = { writerName: "写手", reviewerName: "主编", imageName: "配图师" };
    expect(preferredAssistAgentName("edit", names)).toBe("写手");
    expect(preferredAssistAgentName("continue", names)).toBe("写手");
    expect(preferredAssistAgentName("review-document", names)).toBe("主编");
    expect(preferredAssistAgentName("image", names)).toBe("配图师");
    expect(preferredAssistAgentName("format-selection", { formatterName: "排版" })).toBe("排版");
    expect(assistSeatForKind("edit")).toBe("writer");
    expect(assistSeatForKind("review-document")).toBe("reviewer");
    expect(assistSeatForKind("format-selection")).toBe("formatter");
    expect(assistSeatForKind("image")).toBe("illustrator");
    expect(
      pickAssistAgent(
        [{ name: "内容向导" }, { name: "写手" }, { name: "主编" }],
        "edit",
        names,
      )?.name,
    ).toBe("写手");
  });

  it("names the hired writer in the bubble assistant prompt", () => {
    const { system } = editorAssistMessages({
      kind: "edit",
      target: "一段",
      document: "",
      instruction: "",
      agentNames: { writerName: "写手" },
    });
    expect(system).toContain("写手");
    expect(system).toContain("选区旁的图标气泡");
    expect(system).toContain("不要让用户再选 Agent");
  });

  it("treats a near-complete selection as the whole article", () => {
    expect(isWholeArticleSelection("abc", "abc")).toBe(true);
    expect(isWholeArticleSelection("一段", "整篇")).toBe(false);
  });

  it("asks for a cover image when the instruction is a theme cover", () => {
    const { user } = editorAssistMessages({
      kind: "image",
      target: "选区",
      document: "整篇正文",
      instruction: "主题封面",
    });
    expect(user).toContain("主题封面配图");
    expect(user).toContain("整篇正文");
  });

  it("keeps a selected range even after the editor loses focus", () => {
    expect(
      resolveAssistRange({
        from: 12,
        to: 20,
        empty: false,
        blockFrom: 1,
        blockTo: 40,
        selectedText: "选中的句子",
        blockText: "整段",
      }),
    ).toEqual({ from: 12, to: 20, text: "选中的句子" });
    expect(
      resolveAssistRange({
        from: 8,
        to: 8,
        empty: true,
        blockFrom: 1,
        blockTo: 20,
        selectedText: "",
        blockText: "光标所在段",
      }),
    ).toEqual({ from: 1, to: 20, text: "光标所在段" });
  });

  it("reads an image prompt from a single line", () => {
    expect(extractImagePrompt("配图：一张书桌前的笔记本电脑，暖光")).toBe(
      "一张书桌前的笔记本电脑，暖光",
    );
    expect(unwrapAssistText("```markdown\n续写一段\n```")).toBe("续写一段");
  });
});
