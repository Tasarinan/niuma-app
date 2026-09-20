import { describe, expect, it } from "vitest";
import { canonicalNiumaSkillSlug, expandNiumaSkillSlug } from "./skill-slugs";

describe("expandNiumaSkillSlug", () => {
  it("maps legacy wechat-article-writing aliases to article-writing", () => {
    expect(canonicalNiumaSkillSlug("wechat-article-writing")).toBe("article-writing");
    expect(canonicalNiumaSkillSlug("aws-wechat-article-writing")).toBe("article-writing");
    expect(expandNiumaSkillSlug("wechat-article-writing")).toEqual(
      expect.arrayContaining([
        "article-writing",
        "wechat-article-writing",
        "aws-wechat-article-writing",
      ]),
    );
    expect(expandNiumaSkillSlug("article-writing")).toEqual(
      expect.arrayContaining([
        "article-writing",
        "wechat-article-writing",
        "aws-wechat-article-writing",
      ]),
    );
  });

  it("leaves unrelated slugs unchanged", () => {
    expect(expandNiumaSkillSlug("ima-skill")).toEqual(["ima-skill"]);
  });

  it("renames assets, formatting, and platform publish slugs", () => {
    expect(canonicalNiumaSkillSlug("wechat-article-assets")).toBe("article-assets");
    expect(canonicalNiumaSkillSlug("wechat-article-publish")).toBe(
      "article-publish-wechat",
    );
    expect(canonicalNiumaSkillSlug("wechat-article-formatting")).toBe(
      "article-formatting-wechat",
    );
    expect(canonicalNiumaSkillSlug("wechat-article-main")).toBe("article-main");
    expect(canonicalNiumaSkillSlug("wechat-article-images")).toBe("article-images");
    expect(expandNiumaSkillSlug("article-formatting-wechat")).toEqual(
      expect.arrayContaining([
        "article-formatting-wechat",
        "wechat-article-formatting",
        "aws-wechat-article-formatting",
      ]),
    );
  });
});
