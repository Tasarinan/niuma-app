import { Extension } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import {
  blockStyleToCss,
  compactBlockStyle,
  escapeAttr,
  parseCssToBlockStyle,
  type BlockStyle as BlockStyleAttrs,
} from "@/lib/wechat/block-style";

export const BLOCK_STYLE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "table",
  "image",
  "horizontalRule",
  "callout",
  "hero",
  "quote-card",
  "steps",
  "card",
];

export function cssFromNodeAttrs(attrs: Record<string, unknown> | undefined): string {
  return blockStyleToCss((attrs?.nmStyle as BlockStyleAttrs | null | undefined) ?? null);
}

export function wrapStyledHtml(tag: string, attrs: Record<string, unknown> | undefined, inner: string): string | null {
  const css = cssFromNodeAttrs(attrs);
  if (!css) return null;
  return `<${tag} style="${escapeAttr(css)}">${inner}</${tag}>`;
}

export function tableNodeToHtml(node: JSONContent, css: string): string {
  const style = css ? ` style="${escapeAttr(css)}"` : "";
  const rows = node.content ?? [];
  const body = rows
    .map((row) => {
      const cells = (row.content ?? [])
        .map((cell) => {
          const tag = cell.type === "tableHeader" ? "th" : "td";
          const text = flattenText(cell);
          return `<${tag}>${text}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table${style}>${body}</table>`;
}

function flattenText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return escapeHtml(node.text ?? "");
  return (node.content ?? []).map((child) => flattenText(child)).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const BlockStyle = Extension.create({
  name: "blockStyle",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_STYLE_TYPES,
        attributes: {
          nmStyle: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const css = element.getAttribute("style") || "";
              return compactBlockStyle(parseCssToBlockStyle(css));
            },
            renderHTML: (attributes: { nmStyle?: BlockStyleAttrs | null }) => {
              const css = blockStyleToCss(attributes.nmStyle);
              return css ? { style: css } : {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockStyle:
        (patch: BlockStyleAttrs) =>
        ({ editor, commands }) => {
          const target = blockTypeAtSelection(editor);
          if (!target) return false;
          const current = compactBlockStyle(
            (editor.getAttributes(target).nmStyle as BlockStyleAttrs | null) ?? null,
          );
          const merged: BlockStyleAttrs = { ...(current ?? {}), ...patch };
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) delete (merged as Record<string, unknown>)[key];
          }
          const next = compactBlockStyle(merged);
          return commands.updateAttributes(target, { nmStyle: next });
        },
      unsetBlockStyle:
        () =>
        ({ editor, commands }) => {
          const target = blockTypeAtSelection(editor);
          if (!target) return false;
          return commands.updateAttributes(target, { nmStyle: null });
        },
    };
  },
});

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    blockStyle: {
      setBlockStyle: (patch: BlockStyleAttrs) => ReturnType;
      unsetBlockStyle: () => ReturnType;
    };
  }
}

const NESTED = new Set(["tableRow", "tableCell", "tableHeader", "listItem", "taskItem"]);

export function blockTypeAtSelection(editor: { state: { selection: { $from: { depth: number; node: (d: number) => { type: { name: string } } } } } }): string | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (NESTED.has(name)) continue;
    if (BLOCK_STYLE_TYPES.includes(name)) return name;
    if ($from.node(depth).type.name !== "doc") return name;
  }
  return null;
}
