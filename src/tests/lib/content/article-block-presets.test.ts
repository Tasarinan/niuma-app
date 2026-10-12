import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fillArticleBlockPlaceholders,
  groupArticleBlockPresets,
  parseArticleBlockIndex,
} from "@/lib/content/article-block-presets";

const INDEX = `# catalog
templates:
  - id: lushu
    name: 乾坤AI路书
    series: lushu
    slot: kit
    file: lushu.md
    description: 工具介绍全文骨架
  - id: follow
    name: 关注引导
    series: shared
    slot: follow
    file: follow.md
  - id: evil
    name: skip
    file: ../secret.md
`;

describe("article block presets", () => {
  it("reads template entries from index.yaml", () => {
    const items = parseArticleBlockIndex(INDEX);
    expect(items.map((item) => item.id)).toEqual(["lushu", "follow"]);
    expect(items[0]).toMatchObject({
      name: "乾坤AI路书",
      file: "lushu.md",
      description: "工具介绍全文骨架",
    });
  });

  it("lists narrative frameworks ahead of column kits", () => {
    const raw = readFileSync(join(".teams/content/editor/blocks/index.yaml"), "utf8");
    const items = parseArticleBlockIndex(raw);
    const groups = groupArticleBlockPresets(items);
    expect(groups.map((group) => group.label)).toEqual(["框架", "栏目", "组件"]);
    expect(groups[0].items).toHaveLength(18);
    expect(groups[0].items.every((item) => item.id.startsWith("framework-"))).toBe(true);
    expect(groups[1].items.map((item) => item.id)).toEqual(["lushu", "fde", "foreign"]);
    expect(groups[2].items.map((item) => item.id)).toContain("greeting");
    for (const item of groups[0].items) {
      const markdown = readFileSync(join(".teams/content/editor/blocks", item.file), "utf8");
      expect(markdown).toContain("## ");
      expect(markdown).not.toContain(":::hero");
      expect(markdown).not.toContain("background:");
    }
    for (const item of groups[1].items) {
      const markdown = readFileSync(join(".teams/content/editor/blocks", item.file), "utf8");
      expect(markdown).toContain(":::hero");
      expect(markdown).toContain("{{body}}");
    }
  });

  it("fills known placeholders and keeps the rest", () => {
    expect(
      fillArticleBlockPlaceholders("《{{title}}》约 {{minutes}} 分钟", {
        title: "AI 原生编辑部",
      }),
    ).toBe("《AI 原生编辑部》约 {{minutes}} 分钟");
  });
});
