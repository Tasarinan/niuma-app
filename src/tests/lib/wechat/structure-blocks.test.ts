import { describe, expect, it } from "vitest";
import {
  extractMarkdownHeadings,
  parseStructureBlock,
  replaceStructureFences,
  serializeStructureBlock,
  structureBlockToPreviewHtml,
} from "@/lib/wechat/structure-blocks";

const CALLOUT = `:::callout
type: warning
title: 注意

发布前请检查图片和链接。
:::`;

describe("structure fences", () => {
  it("parses a callout fence with type, title, and body", () => {
    expect(parseStructureBlock("callout", "type: warning\ntitle: 注意\n\n发布前请检查图片和链接。")).toEqual({
      kind: "callout",
      type: "warning",
      title: "注意",
      body: "发布前请检查图片和链接。",
    });
  });

  it("round-trips callout / hero / quote-card / steps", () => {
    const callout = parseStructureBlock("callout", "type: tip\ntitle: 提示\n\n记得配图。")!;
    expect(parseStructureBlock("callout", serializeStructureBlock(callout).replace(/^:::callout\n/, "").replace(/\n:::$/, ""))).toEqual(
      callout,
    );

    const hero = { kind: "hero" as const, title: "开篇", subtitle: "副标题" };
    expect(serializeStructureBlock(hero)).toContain(":::hero");
    expect(serializeStructureBlock(hero)).toContain("title: 开篇");

    const quote = { kind: "quote-card" as const, quote: "好的工具不替你思考", cite: "佚名" };
    expect(serializeStructureBlock(quote)).toContain("quote: 好的工具不替你思考");

    const steps = {
      kind: "steps" as const,
      items: [
        { title: "第一步", body: "导入" },
        { title: "第二步", body: "" },
      ],
    };
    const parsedSteps = parseStructureBlock(
      "steps",
      serializeStructureBlock(steps).replace(/^:::steps\n/, "").replace(/\n:::$/, ""),
    );
    expect(parsedSteps).toEqual(steps);
  });

  it("replaces fences with preview HTML and leaves code fences alone", () => {
    const md = `${CALLOUT}\n\n\`\`\`\n:::callout\ntype: info\n:::\n\`\`\`\n`;
    const html = replaceStructureFences(md, structureBlockToPreviewHtml);
    expect(html).toContain('data-structure="callout"');
    expect(html).toContain("nm-callout-warning");
    expect(html.split("```")[0]).not.toContain(":::callout");
    expect(html).toContain("```\n:::callout");
  });

  it("round-trips a card fence", () => {
    const card = parseStructureBlock("card", "title: 卡片\nvariant: accent\n\n正文")!;
    expect(card).toMatchObject({ kind: "card", title: "卡片", variant: "accent", body: "正文" });
    expect(serializeStructureBlock(card as never)).toContain(":::card");
  });

  it("keeps block fontSize on a card and puts it on preview HTML", () => {
    const card = parseStructureBlock("card", "title: 卡片\nfontSize: 20\n\n正文")!;
    expect(card?.style).toMatchObject({ fontSize: 20 });
    const markdown = serializeStructureBlock(card as never);
    expect(markdown).toContain("fontSize: 20");
    expect(structureBlockToPreviewHtml(card as never)).toContain("font-size: 20px");
  });

  it("extracts headings and ignores headings inside fences", () => {
    const md = `# 标题\n\n:::callout\ntype: info\n\n## 内部\n:::\n\n## 第二节\n`;
    expect(extractMarkdownHeadings(md)).toEqual([
      { level: 1, text: "标题" },
      { level: 2, text: "第二节" },
    ]);
  });
});
