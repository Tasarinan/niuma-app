import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { afterEach, describe, expect, it } from "vitest";
import { loadArticleMarkdown } from "@/components/article-editor/set-markdown";

const FILE_MARKDOWN = `# 标题

第一段。

第二段。
`;

function createMarkdownEditor() {
  return new Editor({
    extensions: [StarterKit, Markdown],
    content: "",
    contentType: "markdown",
  });
}

describe("loadArticleMarkdown", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("keeps headings and paragraph breaks when loading a markdown file", () => {
    editor = createMarkdownEditor();
    loadArticleMarkdown(editor, FILE_MARKDOWN);

    const types = editor.getJSON().content?.map((node) => node.type) ?? [];
    expect(types[0]).toBe("heading");
    expect(types.filter((type) => type === "paragraph")).toHaveLength(2);
    expect(editor.getText()).toContain("\n");
  });

  it("does not keep the previous file in the undo stack after a load", () => {
    editor = createMarkdownEditor();
    loadArticleMarkdown(editor, "# 旧稿\n\n旧正文。\n");
    editor.commands.insertContent("改");
    expect(editor.can().undo()).toBe(true);
    loadArticleMarkdown(editor, "# 新稿\n\n新正文。\n");
    expect(editor.getText()).toContain("新稿");
    editor.commands.undo();
    expect(editor.getText()).toContain("新稿");
    expect(editor.getText()).not.toContain("旧稿");
  });

  it("undoes and redoes edits after a file is loaded", () => {
    editor = createMarkdownEditor();
    loadArticleMarkdown(editor, "# 新稿\n\n新正文。\n");
    editor.commands.insertContent("改");
    expect(editor.getText()).toContain("改");
    editor.commands.undo();
    expect(editor.getText()).not.toContain("改");
    editor.commands.redo();
    expect(editor.getText()).toContain("改");
  });
});
