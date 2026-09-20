import { describe, expect, it } from "vitest";
import {
  buildCommandExecutionPrompt,
  getSlashArgumentCompletion,
  inferArgumentChoices,
  parseCommandArguments,
  parseSlashCommandAgent,
  parseSlashInvocation,
  parseSlashQuery,
  rankSlashCommands,
  type SlashCommandDefinition,
} from "./index";

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

  it("routes layout/publish-style commands to 小助理 from frontmatter", () => {
    expect(
      parseSlashCommandAgent(`---
description: 排版
agent: 小助理
---
# 排版`),
    ).toBe("小助理");
  });

  it("routes /publish to 小助理 even when argument specs are present", () => {
    expect(
      parseSlashCommandAgent(`---
description: 推送到平台草稿箱
agent: 小助理
arguments:
  - name: platform
    description: WECHAT(微信)/XHS(小红书)/ZHIHU(知乎)
    required: true
---
# publish`),
    ).toBe("小助理");
  });

  it("routes /new to 主理人", () => {
    expect(
      parseSlashCommandAgent(`---
description: 开一篇新公众号
agent: 主理人
---
# new`),
    ).toBe("主理人");
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

  it("omits hidden commands from the suggestion menu", () => {
    const hidden = { ...command, name: "publish", hidden: true };
    expect(rankSlashCommands([command, hidden], "").map((item) => item.name)).toEqual([
      "profile",
    ]);
    expect(rankSlashCommands([command, hidden], "pub")).toEqual([]);
  });

  it("inlines command metadata, arguments and user input for the agent", () => {
    const prompt = buildCommandExecutionPrompt(command, "set F");
    expect(prompt).toContain("Slash command invoked: /profile");
    expect(prompt).toContain("User-supplied arguments: set F");
    expect(prompt).toContain("action (required): set/view");
    expect(prompt).toContain("# Profile command");
  });
});