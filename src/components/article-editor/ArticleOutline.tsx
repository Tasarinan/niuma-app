import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorHeading = { level: number; text: string; pos: number };

export function collectEditorHeadings(editor: Editor): EditorHeading[] {
  const headings: EditorHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent.trim() || "无标题",
        pos,
      });
    }
  });
  return headings;
}

export function scrollEditorToHeading(editor: Editor, pos: number) {
  editor.chain().focus().setTextSelection(pos + 1).run();
  const dom = editor.view.nodeDOM(pos);
  const el = dom instanceof HTMLElement ? dom : (dom as { node?: HTMLElement } | null)?.node;
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

type Props = {
  editor: Editor | null;
  embedded?: boolean;
};

export function ArticleOutline({ editor, embedded }: Props) {
  const [headings, setHeadings] = useState<EditorHeading[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }
    const sync = () => {
      setHeadings(collectEditorHeadings(editor));
      const { from } = editor.state.selection;
      let current: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading" && pos <= from) current = pos;
      });
      setActivePos(current);
    };
    sync();
    editor.on("update", sync);
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("update", sync);
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  return (
    <div>
      {embedded ? null : (
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mb-1.5 flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] font-medium uppercase tracking-widest text-slate-400 hover:bg-slate-50"
      >
        大纲
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      )}
      {!(embedded || open) ? null : !editor || headings.length === 0 ? (
        <p className="px-1 text-xs leading-relaxed text-slate-400">写标题后会出现在这里，点击可跳转。</p>
      ) : (
        <nav className="space-y-0.5">
          {headings.map((heading) => (
            <button
              key={`${heading.pos}-${heading.text}`}
              type="button"
              onClick={() => scrollEditorToHeading(editor, heading.pos)}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs leading-snug hover:bg-slate-50",
                heading.level === 1 ? "font-semibold text-slate-800" : "text-slate-600",
                activePos === heading.pos && "bg-indigo-50 text-indigo-700",
              )}
              style={{ paddingLeft: `${0.35 + (heading.level - 1) * 0.55}rem` }}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
