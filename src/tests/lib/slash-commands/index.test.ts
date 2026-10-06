import { describe, expect, it } from "vitest";
import {
  buildCommandExecutionPrompt,
  expandCommandPlaceholders,
  getSlashArgumentCompletion,
  inferArgumentChoices,
  parseArgumentHint,
  parseCommandArguments,
  parseSlashCommandAgent,
  parseSlashInvocation,
  parseSlashQuery,
  rankSlashCommands,
  rankSlashSkills,
  type SlashCommandDefinition,
} from "@/lib/slash-commands/index";

const command: SlashCommandDefinition = {
  name: "profile",
  source: "file",
  sourceLabel: "file",
  path: "profile.md",
  description: "设置基础资料",
  arguments: [
    {
      name: "action",
      description: "set/view",
      required: true,
      choices: [
        { value: "set", description: "" },
        { value: "view", description: "" },
      ],
    },
    {
      name: "gender",
      description: "M/F",
      required: false,
      choices: [
        { value: "M", description: "" },
        { value: "F", description: "" },
      ],
    },
  ],
  content: "# Profile command",
};

describe("slash command parsing", () => {
  it("parses command-name queries only before arguments", () => {
    expect(parseSlashQuery("/prof")).toBe("prof");
    expect(parseSlashQuery("/profile set")).toBeNull();
  });

  it("splits an invocation on its first whitespace boundary", () => {
    expect(parseSlashInvocation("/profile set F 175")).toEqual({
      command: "profile",
      args: "set F 175",
    });
  });

  it("parses standard YAML list items from command frontmatter", () => {
    const raw = `---
description: 设置用户资料
arguments:
  - name: action
    description: set/view
    required: true
  - name: gender
    description: M/F
    required: false
---
# Command`;

    expect(parseCommandArguments(raw)).toEqual(command.arguments);
  });

  it("supports an explicitly empty arguments list", () => {
    expect(parseCommandArguments("---\narguments: []\n---\n# Command")).toEqual([]);
  });

  it("parses Claude/Cursor argument-hint enums", () => {
    expect(parseArgumentHint("[create|edit|update|delete] [target]").map((item) => item.name)).toEqual([
      "action",
      "target",
    ]);
    expect(parseArgumentHint("[WECHAT|XHS|ZHIHU]")[0]?.choices.map((choice) => choice.value)).toEqual([
      "WECHAT",
      "XHS",
      "ZHIHU",
    ]);
  });

  it("keeps agent frontmatter as a legacy fallback", () => {
    expect(
      parseSlashCommandAgent(`---
description: 排版
agent: 发行
---
# 排版`),
    ).toBe("发行");
  });

  it("extracts selectable values and labels from argument descriptions", () => {
    expect(inferArgumentChoices("操作类型：set(设置)/view(查看)")).toEqual([
      { value: "set", description: "设置" },
      { value: "view", description: "查看" },
    ]);
    expect(inferArgumentChoices("操作类型 (record, history, status)")).toEqual([
      { value: "record", description: "" },
      { value: "history", description: "" },
      { value: "status", description: "" },
    ]);
  });

  it("advances through selectable positional arguments", () => {
    const first = getSlashArgumentCompletion("/profile ", [command]);
    expect(first?.argument.name).toBe("action");
    expect(first?.choices.map((choice) => choice.value)).toEqual(["set", "view"]);

    const second = getSlashArgumentCompletion("/profile set ", [command]);
    expect(second?.argument.name).toBe("gender");
    expect(second?.choices.map((choice) => choice.value)).toEqual(["M", "F"]);

    const filtered = getSlashArgumentCompletion("/profile set f", [command]);
    expect(filtered?.prefix).toBe("f");
    expect(filtered?.choices.map((choice) => choice.value)).toEqual(["F"]);
  });
});

describe("slash command completion and execution", () => {
  it("ranks prefix matches before substring matches", () => {
    const commands = [
      { ...command, name: "get-profile" },
      command,
    ];
    expect(rankSlashCommands(commands, "pro").map((item) => item.name)).toEqual([
      "profile",
      "get-profile",
    ]);
  });

  it("ranks team skills for the slash menu and skips command-name collisions", () => {
    const skills = [
      { slug: "article-main", name: "文章生产线", command: "article", description: "开题" },
      { slug: "article-images", name: "配图", command: "image-skill", description: "整理图片" },
      { slug: "grammar", name: "语法", command: "grammar", description: "讲解语法" },
    ];
    expect(
      rankSlashSkills(skills, "", {
        teamSlugs: ["article-main", "article-images"],
        excludeCommands: ["article"],
      }).map((skill) => skill.slug),
    ).toEqual(["article-images"]);
    expect(rankSlashSkills(skills, "语法").map((skill) => skill.slug)).toEqual(["grammar"]);
  });

  it("omits hidden commands from the suggestion menu", () => {
    const hidden = { ...command, name: "publish", hidden: true };
    expect(rankSlashCommands([command, hidden], "").map((item) => item.name)).toEqual([
      "profile",
    ]);
    expect(rankSlashCommands([command, hidden], "pub")).toEqual([]);
  });

  it("expands Claude/Cursor $ARGUMENTS and $0 in the command body", () => {
    const command: SlashCommandDefinition = {
      name: "format",
      source: "file",
      sourceLabel: "file",
      path: "format.md",
      description: "排版",
      arguments: [],
      content: `---
description: 排版
argument-hint: [WECHAT|XHS|ZHIHU]
---
Format for $0.

All args: $ARGUMENTS.
`,
    };
    const prompt = buildCommandExecutionPrompt(command, "WECHAT");
    expect(prompt).toContain("Format for WECHAT.");
    expect(prompt).toContain("All args: WECHAT.");
    expect(prompt).not.toContain("---");
    expect(expandCommandPlaceholders("Use $ARGUMENTS[1].", "a b c")).toBe("Use b.");
  });
});