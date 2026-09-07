import { describe, expect, it } from "vitest";
import { describeAgentToolDone, describeAgentToolProgress } from "./tool-progress";

describe("describeAgentToolProgress", () => {
  it("only names the skill while it is in use", () => {
    expect(describeAgentToolProgress("load_skill", { name: "wechat-article-images" })).toBe(
      "正在使用技能 wechat-article-images",
    );
    expect(describeAgentToolProgress("run_skill", { name: "ima-skill" })).toBe("正在使用技能 ima-skill");
    expect(describeAgentToolDone("正在使用技能 wechat-article-images")).toBe(
      "使用技能 wechat-article-images",
    );
  });

  it("normalizes legacy aws-wechat skill ids for display", () => {
    expect(describeAgentToolProgress("load_skill", { name: "aws-wechat-article-publish" })).toBe(
      "正在使用技能 wechat-article-publish",
    );
  });

  it("hides file read and write noise", () => {
    expect(describeAgentToolProgress("read", { path: "article.md" })).toBeNull();
    expect(describeAgentToolProgress("write", { path: "article.md" })).toBeNull();
    expect(describeAgentToolProgress("edit", { path: "imgs/prompts/cover.md" })).toBeNull();
    expect(describeAgentToolProgress("grep", { pattern: "foo" })).toBeNull();
    expect(describeAgentToolProgress("bash", { command: "python format.py" })).toBeNull();
    expect(describeAgentToolProgress("ls", { path: "." })).toBeNull();
  });

  it("says generate_image uses the system image model", () => {
    expect(describeAgentToolProgress("generate_image", { prompt: "封面" })).toBe(
      "正在用系统图片模型生成配图",
    );
  });

  it("says search_images looks on the public web", () => {
    expect(describeAgentToolProgress("search_images", { query: "白板" })).toBe(
      "正在网上搜索类似图片",
    );
    expect(describeAgentToolProgress("save_web_image", { url: "https://example.com/a.png" })).toBe(
      "正在把网上的图保存为 PNG",
    );
  });

  it("says open_article only locates the manuscript", () => {
    expect(describeAgentToolProgress("open_article", { path: "article.md" })).toBe(
      "正在定位当前文稿",
    );
  });
});
