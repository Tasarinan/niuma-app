import { describe, expect, it } from "vitest";
import { buildSkillCitationPrompt, findCitedSkill } from "@/lib/agent/skill-ref";

const skills = [
  { slug: "ak-rss-digest", name: "ak-rss-digest", command: "ak-rss-digest" },
  { slug: "weather", name: "weather", command: "weather" },
];

describe("findCitedSkill", () => {
  it("matches the folder slug", () => {
    expect(findCitedSkill(skills, "ak-rss-digest")?.slug).toBe("ak-rss-digest");
  });
});

describe("buildSkillCitationPrompt", () => {
  it("tells the agent to load the cited skill and run the task", () => {
    const prompt = buildSkillCitationPrompt(skills[0], "按中文日报格式输出");
    expect(prompt).toContain("load_skill");
    expect(prompt).toContain("ak-rss-digest");
    expect(prompt).toContain("按中文日报格式输出");
  });
});
