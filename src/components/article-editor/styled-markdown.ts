import { Paragraph } from "@tiptap/extension-paragraph";
import { Heading } from "@tiptap/extension-heading";
import { Blockquote } from "@tiptap/extension-blockquote";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { BulletList, OrderedList } from "@tiptap/extension-list";
import { Table } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { cssFromNodeAttrs, tableNodeToHtml, wrapStyledHtml } from "./block-style";
import { escapeAttr } from "@/lib/wechat/block-style";

function parentMarkdown(self: unknown, ...args: unknown[]): string {
  const parent = (self as { parent?: (...inner: unknown[]) => string }).parent;
  return parent?.(...args) ?? "";
}

export const StyledParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, ctx) {
    const inner = parentMarkdown(this, node, helpers, ctx);
    return wrapStyledHtml("p", node.attrs, inner) ?? inner;
  },
});

export const StyledHeading = Heading.extend({
  renderMarkdown(node, helpers) {
    const text = node.content ? helpers.renderChildren(node.content) : "";
    const level = node.attrs?.level ? Number.parseInt(String(node.attrs.level), 10) : 1;
    const styled = wrapStyledHtml(`h${level}`, node.attrs, text);
    if (styled) return styled;
    return `${"#".repeat(level)} ${text}`;
  },
});

export const StyledBlockquote = Blockquote.extend({
  renderMarkdown(node, helpers) {
    const inner = node.content ? helpers.renderChildren(node.content, "\n") : "";
    const quoted = inner
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return wrapStyledHtml("blockquote", node.attrs, inner) ?? quoted;
  },
});

export const StyledHorizontalRule = HorizontalRule.extend({
  renderMarkdown(node) {
    const css = cssFromNodeAttrs(node.attrs);
    return css ? `<hr style="${escapeAttr(css)}" />` : "---";
  },
});

export const StyledBulletList = BulletList.extend({
  renderMarkdown(node, helpers) {
    const inner = parentMarkdown(this, node, helpers);
    return wrapStyledHtml("ul", node.attrs, inner) ?? inner;
  },
});

export const StyledOrderedList = OrderedList.extend({
  renderMarkdown(node, helpers) {
    const inner = parentMarkdown(this, node, helpers);
    return wrapStyledHtml("ol", node.attrs, inner) ?? inner;
  },
});

export const StyledTable = Table.extend({
  renderMarkdown(node, helpers) {
    const css = cssFromNodeAttrs(node.attrs);
    if (css) return tableNodeToHtml(node, css);
    return parentMarkdown(this, node, helpers);
  },
});

export const StyledImage = Image.extend({
  renderMarkdown(node) {
    const src = node.attrs?.src ?? "";
    const alt = node.attrs?.alt ?? "";
    const title = node.attrs?.title ?? "";
    const fallback = title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    const css = cssFromNodeAttrs(node.attrs);
    if (!css) return fallback;
    const titleAttr = title ? ` title="${escapeAttr(String(title))}"` : "";
    return `<img src="${escapeAttr(String(src))}" alt="${escapeAttr(String(alt))}"${titleAttr} style="${escapeAttr(css)}" />`;
  },
});

export const StyledCodeBlockLowlight = CodeBlockLowlight.extend({
  renderMarkdown(node, helpers) {
    const inner = parentMarkdown(this, node, helpers);
    return wrapStyledHtml("pre", node.attrs, inner) ?? inner;
  },
});
