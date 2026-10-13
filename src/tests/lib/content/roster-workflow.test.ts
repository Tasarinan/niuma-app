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
    skills: ["content-router"],
    commands: ["draft"],
    summary: "",
  },
  {
    agentFile: "art.md",
    name: "画师",
    skills: ["image-generator"],
    commands: ["pics"],
    summary: "",
  },
  {
    agentFile: "ship.md",
    name: "出口",
    skills: ["wechat-formatting", "wechat-publish"],
    commands: ["layout", "ship"],
    summary: "",
  },
  {
    agentFile: "pen.md",
    name: "执笔",
    skills: ["manuscript-writer"],
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
    expect(copy.reviewerName).toBeUndefined();
    expect(copy.imageName).toBe("画师");
    expect(copy.publisherName).toBe("出口");
    expect(copy.draftCommand).toBe("draft");
    expect(topicNotConfirmedMessage(copy)).toContain("/draft");
    expect(topicNotConfirmedMessage(copy)).toContain("接待");
    expect(topicNotConfirmedMessage(copy)).not.toContain("主理人");
  });

  it("treats /outline as the draft opener and does not dump host /style into draft", () => {
    const contentLike: TeamRoleDefinition[] = [
      {
        agentFile: "guide.md",
        name: "内容向导",
        skills: ["web-to-markdown"],
        commands: ["style", "record", "scrap"],
        summary: "",
      },
      {
        agentFile: "writer.md",
        name: "写手",
        skills: ["manuscript-writer"],
        commands: ["outline"],
        summary: "",
      },
      {
        agentFile: "publisher.md",
        name: "发行",
        skills: ["wechat-formatting", "wechat-publish"],
        commands: ["publish"],
        summary: "",
      },
    ];
    const commands = resolveContentWorkflowCommands(contentLike, "record");
    expect(commands.draft).toEqual(["outline"]);
    expect(commands.publish).toEqual(["publish"]);
    expect(hasFamilyCommand(commands, "draft", "style")).toBe(false);
    expect(resolveContentRosterCopy(contentLike, { defaultAgent: "guide.md", defaultCommand: "record" }).draftCommand).toBe(
      "outline",
    );
  });

  it("resolves team asset paths from pack id and formatting skill", () => {
    expect(editorialConfigRel("studio")).toBe(".teams/studio/editor/editorial.yaml");
    expect(firstFormattingSkill(roles)).toBe("wechat-formatting");
    expect(formatThemeBuiltinDir("studio", "wechat-formatting")).toBe(
      ".teams/studio/editor/themes/builtin",
    );
  });
});
