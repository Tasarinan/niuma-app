import { describe, expect, it } from "vitest";
import { buildSkillCitationPrompt, findCitedSkill } from "@/lib/agent/skill-ref";

const skills = [
  { slug: "topic-analyzer", name: "topic-analyzer", command: "topic-analyzer" },
  { slug: "weather", name: "weather", command: "weather" },
];

describe("findCitedSkill", () => {
  it("matches the folder slug", () => {
    expect(findCitedSkill(skills, "topic-analyzer")?.slug).toBe("topic-analyzer");
  });
});

describe("buildSkillCitationPrompt", () => {
  it("tells the agent to load the cited skill and run the task", () => {
    const prompt = buildSkillCitationPrompt(skills[0], "按中文日报格式输出");
    expect(prompt).toContain("load_skill");
    expect(prompt).toContain("topic-analyzer");
    expect(prompt).toContain("按中文日报格式输出");
  });
});
