import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Selection, Focus } from "@tiptap/extensions";
import { FileHandler } from "@tiptap/extension-file-handler";
import { Markdown } from "@tiptap/markdown";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useEffect, useMemo } from "react";
import i18n from "@/i18n";
import { MathExtension } from "./math";
import { SlashCommands } from "./slash-commands";
import { suggestionItems } from "./suggestion-items";

const lowlight = createLowlight(common);

interface Props {
  content?: string;
  onUpdate?: (markdown: string) => void;
  onCreate?: (markdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onDropFile?: (editor: Editor, files: File[], position: number) => void;
  onPasteFile?: (editor: Editor, files: File[]) => void;
  editable?: boolean;
}

export const ArticleEditor = ({
  content,
  onUpdate,
  onCreate,
  onEditorReady,
  onDropFile,
  onPasteFile,
  editable = true,
}: Props) => {
  const onUpdateRef = { current: onUpdate };
  onUpdateRef.current = onUpdate;
  const onDropFileRef = { current: onDropFile };
  onDropFileRef.current = onDropFile;
  const onPasteFileRef = { current: onPasteFile };
  onPasteFileRef.current = onPasteFile;

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    content: content ?? "",
    contentType: "markdown",
    editable,
    editorProps: {
      attributes: {
        class:
          "article-editor typography min-h-full max-w-none px-8 py-10 text-[15px] outline-none sm:px-12",
      },
    },
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false }),
      Selection,
      Focus.configure({ className: "has-focus", mode: "all" }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading")
            return i18n.t("articles.headingPlaceholder", { ns: "pages" });
          return i18n.t("articles.bodyPlaceholder", { ns: "pages" });
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true, allowTableNodeSelection: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      MathExtension,
      FileHandler.configure({
        allowedMimeTypes: [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "image/svg+xml",
        ],
        onDrop: (editorInstance, files, position) => {
          onDropFileRef.current?.(editorInstance, files, position);
        },
        onPaste: (editorInstance, files) => {
          onPasteFileRef.current?.(editorInstance, files);
        },
      }),
      Markdown.configure({ indentation: { style: "space", size: 2 } }),
      SlashCommands.configure({ commandItems: suggestionItems }),
    ],
    onCreate({ editor: instance }) {
      onCreate?.(instance.getMarkdown());
    },
    onUpdate({ editor: instance }) {
      onUpdateRef.current?.(instance.getMarkdown());
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
    // onEditorReady intentionally omitted: we only want to fire when editor instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const providerValue = useMemo(() => ({ editor }), [editor]);
  if (!editor) return null;

  return (
    <EditorContext.Provider value={providerValue}>
      <EditorContent editor={editor} className="h-full" />
    </EditorContext.Provider>
  );
};
