import { describe, expect, it } from "vitest";
import {
  extractMentionNames,
  findSlashToken,
  orderSkillsForSeat,
  parseTrailingSlashQuery,
  pickBestSkill,
  replaceTrailingSlashToken,
} from "@/lib/chat/composer-routing";

describe("composer routing", () => {
  it("opens a slash token after an @ mention", () => {
    expect(parseTrailingSlashQuery("@主理人 请调用/ne")).toEqual({
      query: "ne",
      slashIndex: "@主理人 请调用".length,
    });
    expect(parseTrailingSlashQuery("@写手 请用/article-writing 来写")).toBeNull();
  });

  it("reads /command or /skill anywhere in the line", () => {
    expect(findSlashToken("@主理人 请调用/new 新开一篇MARKDOWN 文章")).toEqual({
      name: "new",
      args: "新开一篇MARKDOWN 文章",
    });
    expect(findSlashToken("@写手 请用/article-writing 来写这篇")).toEqual({
      name: "article-writing",
      args: "来写这篇",
    });
  });

  it("keeps the text before the slash when inserting a token", () => {
    expect(replaceTrailingSlashToken("@写手 请用/wri", "article-writing")).toBe(
      "@写手 请用/article-writing ",
    );
  });

  it("lists @ names", () => {
    expect(extractMentionNames("@主理人 请 @写手 看一下")).toEqual(["主理人", "写手"]);
  });

  it("puts the seat's own skills first", () => {
    const skills = [
      { slug: "article-images", name: "配图" },
      { slug: "article-writing", name: "写作" },
    ];
    expect(orderSkillsForSeat(skills, ["article-writing"]).map((skill) => skill.slug)).toEqual([
      "article-writing",
      "article-images",
    ]);
  });

  it("picks a catalog skill only when the request overlaps", () => {
    const skills = [
      { slug: "article-writing", name: "写作", description: "写 Markdown 文章" },
      { slug: "weather", name: "天气", description: "查询天气" },
    ];
    expect(pickBestSkill(skills, "帮我写一篇 markdown")?.slug).toBe("article-writing");
    expect(pickBestSkill(skills, "你好")).toBeUndefined();
  });
});
