import { describe, expect, it } from "vitest";
import type { TeamRoleDefinition } from "@/lib/agent/team-manifest";
import {
  editorialConfigRel,
  firstFormattingSkill,
  formatThemeBuiltinDir,
  hasFamilyCommand,
  imageRoleNames,
  resolveContentRosterCopy,
  resolveContentWorkflowCommands,
  topicNotConfirmedMessage,
} from "@/lib/content/roster-workflow";

const roles: TeamRoleDefinition[] = [
  {
    agentFile: "host.md",
    name: "接待",
    skills: ["article-main"],
    commands: ["draft"],
    summary: "",
  },
  {
    agentFile: "art.md",
    name: "画师",
    skills: ["article-images"],
    commands: ["pics"],
    summary: "",
  },
  {
    agentFile: "ship.md",
    name: "出口",
    skills: ["article-formatting-wechat", "article-publish-wechat"],
    commands: ["layout", "ship"],
    summary: "",
  },
  {
    agentFile: "pen.md",
    name: "执笔",
    skills: ["article-writing"],
    commands: [],
    summary: "",
  },
];

describe("content roster workflow", () => {
  it("maps command families from skills, not seat names", () => {
    const commands = resolveContentWorkflowCommands(roles, "draft");
    expect(commands.draft).toEqual(["draft"]);
    expect(commands.image).toEqual(["pics"]);
    expect(commands.format).toEqual(["layout"]);
    expect(commands.publish).toEqual(["ship"]);
    expect(hasFamilyCommand(commands, "image", "pics")).toBe(true);
    expect(hasFamilyCommand(commands, "image", "image")).toBe(false);
    expect(imageRoleNames(roles)).toEqual(["画师"]);
  });

  it("builds copy from role names", () => {
    const copy = resolveContentRosterCopy(roles, { defaultAgent: "host.md" });
    expect(copy.hostName).toBe("接待");
    expect(copy.specialistNames).toEqual(["画师", "出口", "执笔"]);
    expect(copy.writerName).toBe("执笔");
    expect(copy.imageName).toBe("画师");
    expect(copy.publisherName).toBe("出口");
    expect(copy.draftCommand).toBe("draft");
    expect(topicNotConfirmedMessage(copy)).toContain("/draft create");
    expect(topicNotConfirmedMessage(copy)).toContain("接待");
    expect(topicNotConfirmedMessage(copy)).not.toContain("主理人");
  });

  it("resolves team asset paths from pack id and formatting skill", () => {
    expect(editorialConfigRel("studio")).toBe(".niuma/teams/studio/presets/editorial.yaml");
    expect(firstFormattingSkill(roles)).toBe("article-formatting-wechat");
    expect(formatThemeBuiltinDir("studio", "article-formatting-wechat")).toBe(
      ".niuma/teams/studio/skills/article-formatting-wechat/references/presets/themes",
    );
  });
});
