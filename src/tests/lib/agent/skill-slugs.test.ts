import { describe, expect, it } from "vitest";
import { canonicalNiumaSkillSlug, expandNiumaSkillSlug } from "@/lib/agent/skill-slugs";

describe("skill slugs", () => {
  it("keeps the catalog folder name", () => {
    expect(canonicalNiumaSkillSlug(" article-writing ")).toBe("article-writing");
    expect(expandNiumaSkillSlug("ima-skill")).toEqual(["ima-skill"]);
  });
});
