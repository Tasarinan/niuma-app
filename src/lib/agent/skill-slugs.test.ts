import { describe, expect, it } from "vitest";
import { canonicalNiumaSkillSlug, expandNiumaSkillSlug } from "./skill-slugs";

describe("expandNiumaSkillSlug", () => {
  it("maps aws-wechat-* and wechat-* to the same lookup keys", () => {
    expect(expandNiumaSkillSlug("wechat-article-writing")).toEqual([
      "wechat-article-writing",
      "aws-wechat-article-writing",
    ]);
    expect(expandNiumaSkillSlug("aws-wechat-article-writing")).toEqual([
      "aws-wechat-article-writing",
      "wechat-article-writing",
    ]);
  });

  it("leaves unrelated slugs unchanged", () => {
    expect(expandNiumaSkillSlug("ima-skill")).toEqual(["ima-skill"]);
  });

  it("strips aws- prefix for display and prompts", () => {
    expect(canonicalNiumaSkillSlug("aws-wechat-article-publish")).toBe(
      "wechat-article-publish",
    );
    expect(canonicalNiumaSkillSlug("wechat-article-publish")).toBe(
      "wechat-article-publish",
    );
  });
});
