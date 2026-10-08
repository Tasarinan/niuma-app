import { describe, expect, it } from "vitest";
import {
  isArticleEditUiCommand,
  isImageCommand,
  parseArticleCommandArgs,
  resolveArticleDraftWorkflow,
} from "@/lib/content/workflow-command";

describe("content article slash command", () => {
  it("parses create / edit / delete / update actions", () => {
    expect(parseArticleCommandArgs("create 选题").action).toBe("create");
    expect(parseArticleCommandArgs("create 选题").rest).toBe("选题");
    expect(parseArticleCommandArgs("edit").action).toBe("edit");
    expect(parseArticleCommandArgs("edit foo").rest).toBe("foo");
    expect(parseArticleCommandArgs("delete old-draft").action).toBe("delete");
    expect(parseArticleCommandArgs("update 标题 x").action).toBe("update");
  });

  it("resolves draft workflow intents", () => {
    expect(resolveArticleDraftWorkflow("article", "create")?.intent).toBe("create");
    expect(resolveArticleDraftWorkflow("article", "edit 路书")?.intent).toBe("continue");
    expect(resolveArticleDraftWorkflow("draft", "路书")?.intent).toBe("create");
    expect(resolveArticleDraftWorkflow("continue", "下一节")?.intent).toBe("continue");
    expect(resolveArticleDraftWorkflow("new", "")?.intent).toBe("create");
    expect(resolveArticleDraftWorkflow("resume", "x")?.intent).toBe("continue");
  });

  it("recognizes /image for illustrator workflow", () => {
    expect(isImageCommand("image")).toBe(true);
    expect(isImageCommand("IMAGE")).toBe(true);
  });

  it("treats bare /article edit as UI-only", () => {
    expect(isArticleEditUiCommand("article", "edit")).toBe(true);
    expect(isArticleEditUiCommand("article", "edit 路书")).toBe(false);
    expect(isArticleEditUiCommand("edit", "")).toBe(true);
  });
});
