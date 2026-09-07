import { describe, expect, it } from "vitest";
import { fillArticleBlockPlaceholders, parseArticleBlockIndex } from "./article-block-presets";

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

  it("fills known placeholders and keeps the rest", () => {
    expect(
      fillArticleBlockPlaceholders("《{{title}}》约 {{minutes}} 分钟", {
        title: "AI 原生编辑部",
      }),
    ).toBe("《AI 原生编辑部》约 {{minutes}} 分钟");
  });
});
