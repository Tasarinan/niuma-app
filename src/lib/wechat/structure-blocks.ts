/** Koinote-style `:::kind` fences for WeChat structure blocks. Shared by editor, preview, and tests. */

import {
  applyStyleAttr,
  blockStyleFromFields,
  blockStyleToCss,
  blockStyleToFields,
  type BlockStyle,
} from "./block-style";

export const STRUCTURE_KINDS = ["callout", "hero", "quote-card", "steps", "card"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];
export const CARD_VARIANTS = ["plain", "accent", "outline", "shadow"] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const CALLOUT_TONES = ["info", "success", "warning", "danger", "tip"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export const CALLOUT_COLORS: Record<CalloutTone, { bg: string; bar: string; fg: string; mark: string }> = {
  info: { bg: "#EEF4FF", bar: "#2C6BED", fg: "#1F3A6E", mark: "i" },
  success: { bg: "#EDF7F2", bar: "#1D9E75", fg: "#14543F", mark: "✓" },
  warning: { bg: "#FFF7E6", bar: "#E8A33D", fg: "#7A4E10", mark: "!" },
  danger: { bg: "#FDEDED", bar: "#D64545", fg: "#8E1B1B", mark: "✕" },
  tip: { bg: "#F4F0FF", bar: "#7C5CFF", fg: "#3D2E8C", mark: "★" },
};

export type StepItem = { title: string; body: string };

type WithStyle<T> = T & { style?: BlockStyle | null };

export type ParsedStructureBlock = WithStyle<
  | { kind: "callout"; type: CalloutTone; title: string; body: string }
  | { kind: "hero"; title: string; subtitle: string }
  | { kind: "quote-card"; quote: string; cite: string }
  | { kind: "steps"; items: StepItem[] }
  | { kind: "card"; title: string; body: string; footer: string; variant: CardVariant }
>;

const KIND_RE = STRUCTURE_KINDS.join("|");
const OPEN_RE = new RegExp(`^:::(${KIND_RE})(?:\\s+\\{([^}]*)\\})?\\s*$`);
const FIELD_RE = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/;
const STEP_RE = /^(?:\d+\.|-)\s+(.*)$/;

export function isStructureKind(value: string): value is StructureKind {
  return (STRUCTURE_KINDS as readonly string[]).includes(value);
}

export function normalizeCalloutTone(value: string | undefined): CalloutTone {
  const tone = (value ?? "").trim().toLowerCase();
  return (CALLOUT_TONES as readonly string[]).includes(tone) ? (tone as CalloutTone) : "info";
}

export function parseBraceAttrs(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  const out: Record<string, string> = {};
  const kv = raw.matchAll(/([A-Za-z][\w-]*)\s*=\s*"([^"]*)"/g);
  for (const match of kv) out[match[1]] = match[2];
  return out;
}

export function parseFieldBlock(inner: string): { fields: Record<string, string>; rest: string } {
  const lines = inner.replace(/\r\n/g, "\n").split("\n");
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      break;
    }
    const field = line.match(FIELD_RE);
    if (!field) break;
    fields[field[1]] = field[2].trim();
    i += 1;
  }
  return { fields, rest: lines.slice(i).join("\n").replace(/^\n+/, "").replace(/\n+$/, "") };
}

export function parseStepItems(text: string): StepItem[] {
  const items: StepItem[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) continue;
    const indent = /^(?: {2,}|\t)(.+)$/.exec(line);
    if (indent && items.length > 0) {
      const extra = indent[1].trim();
      const last = items[items.length - 1];
      last.body = last.body ? `${last.body}\n${extra}` : extra;
      continue;
    }
    const step = line.trim().match(STEP_RE);
    if (step) {
      items.push({ title: step[1].trim(), body: "" });
      continue;
    }
    if (items.length > 0) {
      const last = items[items.length - 1];
      last.body = last.body ? `${last.body}\n${line.trim()}` : line.trim();
    }
  }
  return items;
}

export function parseStructureBlock(
  kind: string,
  inner: string,
  braceAttrs?: Record<string, string>,
): ParsedStructureBlock | null {
  if (!isStructureKind(kind)) return null;
  const { fields, rest } = parseFieldBlock(inner);
  const attrs = { ...(braceAttrs ?? {}), ...fields };
  const style = blockStyleFromFields(attrs);
  const withStyle = <T extends object>(block: T): T & { style?: BlockStyle | null } =>
    style ? { ...block, style } : block;

  if (kind === "callout") {
    return withStyle({
      kind,
      type: normalizeCalloutTone(attrs.type ?? attrs.tone),
      title: attrs.title ?? "",
      body: attrs.body?.trim() ? attrs.body : rest,
    });
  }
  if (kind === "hero") {
    const [first, ...more] = rest.split("\n").map((line) => line.trim());
    return withStyle({
      kind,
      title: attrs.title ?? first ?? "",
      subtitle: attrs.subtitle ?? more.join("\n").trim(),
    });
  }
  if (kind === "quote-card") {
    const [first, ...more] = rest.split("\n").map((line) => line.trim());
    return withStyle({
      kind,
      quote: attrs.quote ?? first ?? "",
      cite: attrs.cite ?? more.join(" ").trim(),
    });
  }
  if (kind === "card") {
    const variant = CARD_VARIANTS.includes(attrs.variant as CardVariant)
      ? (attrs.variant as CardVariant)
      : "plain";
    return withStyle({
      kind,
      title: attrs.title ?? "",
      footer: attrs.footer ?? "",
      variant,
      body: attrs.body?.trim() ? attrs.body : rest,
    });
  }
  const items = parseStepItems(rest);
  if (items.length === 0 && (attrs.title || attrs.body)) {
    items.push({ title: attrs.title ?? "", body: attrs.body ?? "" });
  }
  return withStyle({ kind, items });
}

export function serializeStructureBlock(block: ParsedStructureBlock): string {
  const lines = [`:::${block.kind}`];
  if (block.kind === "callout") {
    lines.push(`type: ${block.type}`);
    if (block.title.trim()) lines.push(`title: ${flatten(block.title)}`);
    appendStyleFields(lines, block.style);
    if (block.body.trim()) {
      lines.push("");
      lines.push(block.body.replace(/\s+$/, ""));
    }
  } else if (block.kind === "hero") {
    if (block.title.trim()) lines.push(`title: ${flatten(block.title)}`);
    if (block.subtitle.trim()) lines.push(`subtitle: ${flatten(block.subtitle)}`);
    appendStyleFields(lines, block.style);
  } else if (block.kind === "quote-card") {
    if (block.quote.trim()) lines.push(`quote: ${flatten(block.quote)}`);
    if (block.cite.trim()) lines.push(`cite: ${flatten(block.cite)}`);
    appendStyleFields(lines, block.style);
  } else if (block.kind === "card") {
    if (block.title.trim()) lines.push(`title: ${flatten(block.title)}`);
    if (block.footer.trim()) lines.push(`footer: ${flatten(block.footer)}`);
    if (block.variant && block.variant !== "plain") lines.push(`variant: ${block.variant}`);
    appendStyleFields(lines, block.style);
    if (block.body.trim()) {
      lines.push("");
      lines.push(block.body.replace(/\s+$/, ""));
    }
  } else {
    appendStyleFields(lines, block.style);
    for (const item of block.items) {
      lines.push(`1. ${flatten(item.title) || "步骤"}`);
      if (item.body.trim()) lines.push(`   ${flatten(item.body)}`);
    }
  }
  lines.push(":::");
  return lines.join("\n");
}

function appendStyleFields(lines: string[], style: BlockStyle | null | undefined) {
  for (const [key, value] of Object.entries(blockStyleToFields(style))) {
    lines.push(`${key}: ${value}`);
  }
}

export function replaceStructureFences(
  markdown: string,
  render: (block: ParsedStructureBlock) => string,
): string {
  const source = markdown.replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      out.push(line);
      i += 1;
      continue;
    }
    const open = !inCode ? trimmed.match(OPEN_RE) : null;
    if (!open) {
      out.push(line);
      i += 1;
      continue;
    }
    const kind = open[1];
    const brace = parseBraceAttrs(open[2]);
    const inner: string[] = [];
    i += 1;
    let closed = false;
    while (i < lines.length) {
      if (lines[i].trim() === ":::") {
        closed = true;
        i += 1;
        break;
      }
      inner.push(lines[i]);
      i += 1;
    }
    const parsed = parseStructureBlock(kind, inner.join("\n"), brace);
    if (parsed && closed) out.push(render(parsed));
    else {
      out.push(line);
      out.push(...inner);
      if (closed) out.push(":::");
    }
  }
  return out.join("\n");
}

export function structureBlockToPreviewHtml(block: ParsedStructureBlock): string {
  const css = blockStyleToCss(block.style);
  const withStyle = (html: string) => applyStyleAttr(html, css);
  if (block.kind === "callout") {
    const tone = block.type;
    const title = block.title.trim()
      ? `<p class="nm-callout-title">${escapeHtml(block.title)}</p>`
      : "";
    const body = paragraphsHtml(block.body, "nm-callout-body");
    return withStyle(
      `<section class="nm-callout nm-callout-${tone}" data-structure="callout"><span class="nm-callout-mark">${CALLOUT_COLORS[tone].mark}</span><div class="nm-callout-main">${title}${body}</div></section>`,
    );
  }
  if (block.kind === "hero") {
    const sub = block.subtitle.trim()
      ? `<p class="nm-hero-sub">${escapeHtml(block.subtitle)}</p>`
      : "";
    return withStyle(
      `<section class="nm-hero" data-structure="hero"><p class="nm-hero-title">${escapeHtml(block.title)}</p>${sub}</section>`,
    );
  }
  if (block.kind === "quote-card") {
    const cite = block.cite.trim()
      ? `<p class="nm-quote-cite">${escapeHtml(block.cite)}</p>`
      : "";
    return withStyle(
      `<section class="nm-quote-card" data-structure="quote-card"><p class="nm-quote-text">${escapeHtml(block.quote)}</p>${cite}</section>`,
    );
  }
  if (block.kind === "card") {
    const title = block.title.trim()
      ? `<p class="nm-card-title">${escapeHtml(block.title)}</p>`
      : "";
    const footer = block.footer.trim()
      ? `<p class="nm-card-footer">${escapeHtml(block.footer)}</p>`
      : "";
    const body = paragraphsHtml(block.body, "nm-card-body");
    return withStyle(
      `<section class="nm-card nm-card-${block.variant}" data-structure="card">${title}${body}${footer}</section>`,
    );
  }
  const items = block.items
    .map(
      (item, index) =>
        `<li class="nm-step"><span class="nm-step-index">${index + 1}</span><div><p class="nm-step-title">${escapeHtml(item.title)}</p>${item.body.trim() ? `<p class="nm-step-body">${escapeHtml(item.body)}</p>` : ""}</div></li>`,
    )
    .join("");
  return withStyle(
    `<section class="nm-steps" data-structure="steps"><ol class="nm-step-list">${items}</ol></section>`,
  );
}

export function extractMarkdownHeadings(
  markdown: string,
): { level: number; text: string }[] {
  const source = replaceStructureFences(markdown, () => "");
  const headings: { level: number; text: string }[] = [];
  let inCode = false;
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) headings.push({ level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

function flatten(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function paragraphsHtml(text: string, className: string): string {
  const parts = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return `<p class="${className}"></p>`;
  return parts.map((part) => `<p class="${className}">${escapeHtml(part)}</p>`).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
