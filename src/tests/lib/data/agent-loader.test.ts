import { describe, expect, it } from "vitest";
import { parseCatalogAgentMarkdown } from "@/lib/data/agent-loader";

describe("OpenClaw / Claude agent markdown", () => {
  it("reads name, emoji, tools, sandbox, and body as the system prompt", () => {
    const agent = parseCatalogAgentMarkdown(
      "producer.md",
      `---
name: 主理人
description: 内容频道接待
emoji: 🎬
tools:
  - Read
  - Write
  - Glob
sandbox: workspace-write
---

# 主理人

你负责开题和点名。
`,
      "content",
    );
    expect(agent.name).toBe("主理人");
    expect(agent.role).toBe("主理人");
    expect(agent.avatar).toBe("🎬");
    expect(agent.description).toBe("内容频道接待");
    expect(agent.sandboxMode).toBe("workspace-write");
    expect(agent.enabledInternalTools).toEqual(["read", "write", "ls"]);
    expect(agent.systemPrompt).toContain("你负责开题和点名");
  });

  it("maps Claude allowed-tools and model aliases", () => {
    const agent = parseCatalogAgentMarkdown(
      "dev.md",
      `---
name: Dev
description: Engineer
allowed-tools: Read, Grep, Bash(git:*)
model: gpt-4.1
---
You write code.
`,
    );
    expect(agent.enabledInternalTools).toEqual(["read", "grep", "bash"]);
    expect(agent.modelId).toBe("gpt-4.1");
  });
});
