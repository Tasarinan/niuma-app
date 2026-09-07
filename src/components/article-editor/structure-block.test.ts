import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { afterEach, describe, expect, it } from "vitest";
import { loadArticleMarkdown } from "./set-markdown";
import { StructureBlocks } from "./structure-block";
import { BlockStyle } from "./block-style";
import { StyledHeading, StyledParagraph } from "./styled-markdown";
import { collectEditorHeadings } from "./ArticleOutline";

const CALLOUT = `:::callout
type: warning
title: 注意

发布前请检查图片和链接。
:::
`;

function createEditor() {
  return new Editor({
    extensions: [StarterKit, StructureBlocks, Markdown],
    content: "",
    contentType: "markdown",
  });
}

function createStyledEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      StyledParagraph,
      StyledHeading,
      StructureBlocks,
      BlockStyle,
      Markdown,
    ],
    content: "",
    contentType: "markdown",
  });
}

describe("structure block markdown", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("loads a callout fence and writes :::callout back out", () => {
    editor = createEditor();
    loadArticleMarkdown(editor, CALLOUT);
    const types = editor.getJSON().content?.map((node) => node.type) ?? [];
    expect(types).toContain("callout");
    const markdown = editor.getMarkdown();
    expect(markdown).toContain(":::callout");
    expect(markdown).toContain("type: warning");
    expect(markdown).toContain("发布前请检查图片和链接。");
  });

  it("loads a card fence", () => {
    editor = createEditor();
    loadArticleMarkdown(editor, `:::card\ntitle: 卡片\n\n正文\n:::\n`);
    const types = editor.getJSON().content?.map((node) => node.type) ?? [];
    expect(types).toContain("card");
    expect(editor.getMarkdown()).toContain(":::card");
  });

  it("collects headings for the outline", () => {
    editor = createEditor();
    loadArticleMarkdown(editor, "# 一\n\n段\n\n## 二\n");
    expect(collectEditorHeadings(editor).map((item) => item.text)).toEqual(["一", "二"]);
  });

  it("writes paragraph fontSize as HTML so it wins over the theme", () => {
    editor = createStyledEditor();
    loadArticleMarkdown(editor, "hello\n");
    editor.chain().selectAll().setBlockStyle({ fontSize: 20 }).run();
    const markdown = editor.getMarkdown();
    expect(markdown).toContain("font-size: 20px");
    expect(markdown).toContain("<p");

    loadArticleMarkdown(editor, markdown);
    const para = editor.getJSON().content?.[0];
    expect(para?.type).toBe("paragraph");
    expect(para?.attrs?.nmStyle).toMatchObject({ fontSize: 20 });
  });

  it("round-trips card fence fontSize", () => {
    editor = createStyledEditor();
    loadArticleMarkdown(editor, `:::card\ntitle: 卡片\nfontSize: 18\n\n正文\n:::\n`);
    const card = editor.getJSON().content?.find((node) => node.type === "card");
    expect(card?.attrs?.nmStyle).toMatchObject({ fontSize: 18 });
    expect(editor.getMarkdown()).toContain("fontSize: 18");
  });
});
