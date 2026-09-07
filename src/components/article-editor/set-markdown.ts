import type { Editor } from "@tiptap/core";

/** Load a markdown file into TipTap. Must pass contentType or newlines collapse as HTML. */
export function loadArticleMarkdown(editor: Editor, markdown: string): void {
  editor
    .chain()
    .command(({ tr }) => {
      tr.setMeta("addToHistory", false);
      return true;
    })
    .setContent(markdown || "", {
      contentType: "markdown",
      emitUpdate: false,
    })
    .run();
}
