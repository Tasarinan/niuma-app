import { Extension, mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";
import type { MarkdownLexerConfiguration, MarkdownToken } from "@tiptap/core";
import {
  parseBraceAttrs,
  parseStructureBlock,
  serializeStructureBlock,
  type CalloutTone,
  type CardVariant,
  type StepItem,
  type StructureKind,
} from "@/lib/wechat/structure-blocks";
import {
  CalloutView,
  CardView,
  HeroView,
  QuoteCardView,
  StepsView,
} from "./structure-block-view";

function matchFence(src: string, kind: StructureKind) {
  const open = new RegExp(`^:::${kind}(?:\\s+\\{([^}]*)\\})?\\s*\\n`);
  const opening = src.match(open);
  if (!opening) return undefined;
  const rest = src.slice(opening[0].length);
  const closing = rest.match(/^([\s\S]*?)^:::[ \t]*(?:\n|$)/m);
  if (!closing) return undefined;
  return {
    raw: opening[0] + closing[0],
    inner: closing[1],
    brace: parseBraceAttrs(opening[1]),
  };
}

function fenceTokenizer(kind: StructureKind, nodeName: string) {
  return {
    name: nodeName,
    level: "block" as const,
    start: (src: string) => {
      const match = src.match(new RegExp(`^:::${kind}`, "m"));
      return match?.index ?? -1;
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) {
      const matched = matchFence(src, kind);
      if (!matched) return undefined;
      const parsed = parseStructureBlock(kind, matched.inner, matched.brace);
      if (!parsed) return undefined;
      const token: MarkdownToken = {
        type: nodeName,
        raw: matched.raw,
        parsed,
      };
      if (
        (parsed.kind === "callout" || parsed.kind === "card") &&
        parsed.body.trim()
      ) {
        token.tokens = lexer.blockTokens(`${parsed.body}\n`);
      }
      return token;
    },
  };
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    structureBlocks: {
      insertCallout: (attrs?: { type?: CalloutTone; title?: string }) => ReturnType;
      insertHero: (attrs?: { title?: string; subtitle?: string }) => ReturnType;
      insertQuoteCard: (attrs?: { quote?: string; cite?: string }) => ReturnType;
      insertSteps: (items?: StepItem[]) => ReturnType;
      insertCard: (attrs?: { title?: string; footer?: string; variant?: CardVariant }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      type: { default: "info" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-structure="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-structure": "callout" }, HTMLAttributes), 0];
  },

  markdownTokenizer: fenceTokenizer("callout", "callout"),

  parseMarkdown(token: MarkdownToken, helpers: any) {
    const parsed = token.parsed ?? parseStructureBlock("callout", token.content ?? "");
    const content = token.tokens?.length
      ? helpers.parseChildren(token.tokens)
      : [helpers.createNode("paragraph")];
    return helpers.createNode("callout", {
      type: parsed && parsed.kind === "callout" ? parsed.type : "info",
      title: parsed && parsed.kind === "callout" ? parsed.title : "",
      nmStyle: parsed?.style ?? null,
    }, content);
  },

  renderMarkdown(node: any, helpers: any) {
    const body = helpers.renderChildren(node.content ?? [], "\n\n");
    return serializeStructureBlock({
      kind: "callout",
      type: node.attrs?.type ?? "info",
      title: node.attrs?.title ?? "",
      body: typeof body === "string" ? body.trim() : "",
      style: node.attrs?.nmStyle ?? null,
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

export const Hero = Node.create({
  name: "hero",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: "标题" },
      subtitle: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-structure="hero"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-structure": "hero" }, HTMLAttributes)];
  },

  markdownTokenizer: fenceTokenizer("hero", "hero"),

  parseMarkdown(token: MarkdownToken, helpers: any) {
    const parsed = token.parsed;
    return helpers.createNode("hero", {
      title: parsed && parsed.kind === "hero" ? parsed.title : "",
      subtitle: parsed && parsed.kind === "hero" ? parsed.subtitle : "",
      nmStyle: parsed?.style ?? null,
    }, []);
  },

  renderMarkdown(node: any) {
    return serializeStructureBlock({
      kind: "hero",
      title: node.attrs?.title ?? "",
      subtitle: node.attrs?.subtitle ?? "",
      style: node.attrs?.nmStyle ?? null,
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeroView);
  },
});

export const QuoteCard = Node.create({
  name: "quote-card",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      quote: { default: "引用内容" },
      cite: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-structure="quote-card"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-structure": "quote-card" }, HTMLAttributes)];
  },

  markdownTokenizer: fenceTokenizer("quote-card", "quote-card"),

  parseMarkdown(token: MarkdownToken, helpers: any) {
    const parsed = token.parsed;
    return helpers.createNode("quote-card", {
      quote: parsed && parsed.kind === "quote-card" ? parsed.quote : "",
      cite: parsed && parsed.kind === "quote-card" ? parsed.cite : "",
      nmStyle: parsed?.style ?? null,
    }, []);
  },

  renderMarkdown(node: any) {
    return serializeStructureBlock({
      kind: "quote-card",
      quote: node.attrs?.quote ?? "",
      cite: node.attrs?.cite ?? "",
      style: node.attrs?.nmStyle ?? null,
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuoteCardView);
  },
});

export const Steps = Node.create({
  name: "steps",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: [
          { title: "第一步", body: "" },
          { title: "第二步", body: "" },
        ] satisfies StepItem[],
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-structure="steps"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-structure": "steps" }, HTMLAttributes)];
  },

  markdownTokenizer: fenceTokenizer("steps", "steps"),

  parseMarkdown(token: MarkdownToken, helpers: any) {
    const parsed = token.parsed;
    return helpers.createNode("steps", {
      items: parsed && parsed.kind === "steps" ? parsed.items : [],
      nmStyle: parsed?.style ?? null,
    }, []);
  },

  renderMarkdown(node: any) {
    return serializeStructureBlock({
      kind: "steps",
      items: Array.isArray(node.attrs?.items) ? node.attrs.items : [],
      style: node.attrs?.nmStyle ?? null,
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepsView);
  },
});

export const Card = Node.create({
  name: "card",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: "卡片标题" },
      footer: { default: "" },
      variant: { default: "plain" },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-structure="card"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-structure": "card" }, HTMLAttributes), 0];
  },

  markdownTokenizer: fenceTokenizer("card", "card"),

  parseMarkdown(token: MarkdownToken, helpers: any) {
    const parsed = token.parsed ?? parseStructureBlock("card", token.content ?? "");
    const content = token.tokens?.length
      ? helpers.parseChildren(token.tokens)
      : [helpers.createNode("paragraph")];
    return helpers.createNode("card", {
      title: parsed && parsed.kind === "card" ? parsed.title : "",
      footer: parsed && parsed.kind === "card" ? parsed.footer : "",
      variant: parsed && parsed.kind === "card" ? parsed.variant : "plain",
      nmStyle: parsed?.style ?? null,
    }, content);
  },

  renderMarkdown(node: any, helpers: any) {
    const body = helpers.renderChildren(node.content ?? [], "\n\n");
    return serializeStructureBlock({
      kind: "card",
      title: node.attrs?.title ?? "",
      footer: node.attrs?.footer ?? "",
      variant: node.attrs?.variant ?? "plain",
      body: typeof body === "string" ? body.trim() : "",
      style: node.attrs?.nmStyle ?? null,
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardView);
  },
});

export const StructureBlocks = Extension.create({
  name: "structureBlocks",
  addExtensions() {
    return [Callout, Hero, QuoteCard, Steps, Card];
  },
  addCommands() {
    return {
      insertCallout:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: "callout",
            attrs: { type: attrs?.type ?? "info", title: attrs?.title ?? "提示" },
            content: [{ type: "paragraph" }],
          }),
      insertHero:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: "hero",
            attrs: { title: attrs?.title ?? "标题", subtitle: attrs?.subtitle ?? "副标题" },
          }),
      insertQuoteCard:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: "quote-card",
            attrs: { quote: attrs?.quote ?? "引用内容", cite: attrs?.cite ?? "" },
          }),
      insertSteps:
        (items) =>
        ({ commands }) =>
          commands.insertContent({
            type: "steps",
            attrs: {
              items: items ?? [
                { title: "第一步", body: "" },
                { title: "第二步", body: "" },
                { title: "第三步", body: "" },
              ],
            },
          }),
      insertCard:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: "card",
            attrs: {
              title: attrs?.title ?? "卡片标题",
              footer: attrs?.footer ?? "",
              variant: attrs?.variant ?? "plain",
            },
            content: [{ type: "paragraph", content: [{ type: "text", text: "卡片内容" }] }],
          }),
    };
  },
});
