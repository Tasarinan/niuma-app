import { describe, expect, it } from "vitest";
import { canonicalNiumaSkillSlug, expandNiumaSkillSlug } from "@/lib/agent/skill-slugs";

describe("skill slugs", () => {
  it("keeps the catalog folder name", () => {
    expect(canonicalNiumaSkillSlug(" manuscript-writer ")).toBe("manuscript-writer");
    expect(expandNiumaSkillSlug("ima-skill")).toEqual(["ima-skill"]);
  });

  it("maps retired content skill folders onto the current kebab names", () => {
    expect(canonicalNiumaSkillSlug("article-writing")).toBe("manuscript-writer");
    expect(canonicalNiumaSkillSlug("article-topics")).toBe("topic-analyzer");
    expect(canonicalNiumaSkillSlug("article-images")).toBe("image-generator");
    expect(canonicalNiumaSkillSlug("article-review")).toBe("manuscript-reviewer");
    expect(canonicalNiumaSkillSlug("article-formatting-wechat")).toBe("wechat-formatting");
    expect(canonicalNiumaSkillSlug("article-publish-wechat")).toBe("wechat-publish");
    expect(expandNiumaSkillSlug("article-writing")).toEqual(
      expect.arrayContaining(["manuscript-writer", "article-writing"]),
    );
  });
});
