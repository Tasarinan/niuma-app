import { describe, expect, it } from "vitest";
import { resolvePresetSkillIds } from "@/lib/agent/preset-skill-ids";

const skillsBySlug = new Map([
  ["content-router", "id-main"],
  ["manuscript-writer", "id-writing"],
  ["image-generator", "id-images"],
  ["ima-skill", "id-ima"],
]);

describe("resolvePresetSkillIds", () => {
  it("prefers agent frontmatter skills over team-wide slugs", () => {
    expect(
      resolvePresetSkillIds(
        ["manuscript-writer"],
        ["content-router", "manuscript-writer", "image-generator"],
        skillsBySlug,
      ),
    ).toEqual(["id-writing"]);
  });

  it("keeps only the agent's declared skills when set", () => {
    expect(
      resolvePresetSkillIds(
        ["manuscript-writer"],
        ["content-router", "manuscript-writer", "image-generator"],
        skillsBySlug,
      ),
    ).toEqual(["id-writing"]);
  });

  it("treats an explicit empty list as no skills (圆桌顾问)", () => {
    expect(
      resolvePresetSkillIds(
        [],
        ["content-router", "manuscript-writer"],
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
      resolvePresetSkillIds(["missing", "image-generator"], [], skillsBySlug),
    ).toEqual(["id-images"]);
  });

  it("resolves retired article-* slugs to the renamed skill ids", () => {
    expect(resolvePresetSkillIds(["article-writing"], [], skillsBySlug)).toEqual([
      "id-writing",
    ]);
  });
});
