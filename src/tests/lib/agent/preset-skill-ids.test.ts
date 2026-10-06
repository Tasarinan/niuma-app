import { describe, expect, it } from "vitest";
import { resolvePresetSkillIds } from "@/lib/agent/preset-skill-ids";

const skillsBySlug = new Map([
  ["article-main", "id-main"],
  ["article-writing", "id-writing"],
  ["article-images", "id-images"],
  ["ima-skill", "id-ima"],
]);

describe("resolvePresetSkillIds", () => {
  it("prefers config.yaml roles[].skills over catalog and team-wide slugs", () => {
    expect(
      resolvePresetSkillIds(
        ["article-writing"],
        ["article-main", "article-writing", "article-images"],
        skillsBySlug,
        ["article-main"],
      ),
    ).toEqual(["id-main"]);
  });

  it("keeps only the agent's declared skills when no role list is given", () => {
    expect(
      resolvePresetSkillIds(
        ["article-writing"],
        ["article-main", "article-writing", "article-images"],
        skillsBySlug,
      ),
    ).toEqual(["id-writing"]);
  });

  it("treats an explicit empty list as no skills (圆桌顾问)", () => {
    expect(
      resolvePresetSkillIds(
        [],
        ["article-main", "article-writing"],
        skillsBySlug,
      ),
    ).toEqual([]);
  });

  it("falls back to team skillSlugs when the agent omitted the field", () => {
    expect(resolvePresetSkillIds(undefined, ["ima-skill"], skillsBySlug)).toEqual([
      "id-ima",
    ]);
  });

  it("drops slugs that are not in the skill store", () => {
    expect(
      resolvePresetSkillIds(["missing", "article-images"], [], skillsBySlug),
    ).toEqual(["id-images"]);
  });
});
