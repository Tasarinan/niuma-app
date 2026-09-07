import type { ReactNode } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import {
  CALLOUT_COLORS,
  CALLOUT_TONES,
  CARD_VARIANTS,
  type CalloutTone,
  type CardVariant,
  type StepItem,
} from "@/lib/wechat/structure-blocks";
import { blockStyleToCss, type BlockStyle } from "@/lib/wechat/block-style";
import { cssTextToStyle } from "@/lib/wechat/format-theme-css";
import { cn } from "@/lib/utils";

function stopPm(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function nmReactStyle(attrs: Record<string, unknown>) {
  return cssTextToStyle(blockStyleToCss((attrs.nmStyle as BlockStyle | null) ?? null));
}

function Chrome({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="nm-structure-chrome" contentEditable={false}>
      <span className="nm-structure-label">{label}</span>
      {children}
    </div>
  );
}

export function CalloutView({ node, updateAttributes, selected }: NodeViewProps) {
  const tone = (node.attrs.type as CalloutTone) || "info";
  const colors = CALLOUT_COLORS[tone] ?? CALLOUT_COLORS.info;
  return (
    <NodeViewWrapper
      as="section"
      className={cn("nm-callout", `nm-callout-${tone}`, selected && "nm-structure-selected")}
      data-structure="callout"
      style={{ background: colors.bg, borderLeftColor: colors.bar, color: colors.fg, ...nmReactStyle(node.attrs) }}
    >
      <span className="nm-callout-mark" contentEditable={false} style={{ background: colors.bar }}>
        {colors.mark}
      </span>
      <div className="nm-callout-main">
        <Chrome label="提示框">
          <select
            className="nm-structure-select"
            value={tone}
            onMouseDown={stopPm}
            onKeyDown={stopPm}
            onChange={(event) => updateAttributes({ type: event.target.value })}
          >
            {CALLOUT_TONES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Chrome>
        <input
          className="nm-structure-title"
          value={node.attrs.title ?? ""}
          placeholder="标题（可选）"
          onMouseDown={stopPm}
          onKeyDown={stopPm}
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
        <NodeViewContent className="nm-callout-body" />
      </div>
    </NodeViewWrapper>
  );
}

export function HeroView({ node, updateAttributes, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="section"
      className={cn("nm-hero", selected && "nm-structure-selected")}
      data-structure="hero"
      style={nmReactStyle(node.attrs)}
    >
      <Chrome label="开篇" />
      <input
        className="nm-hero-title nm-structure-input"
        value={node.attrs.title ?? ""}
        placeholder="主标题"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ title: event.target.value })}
      />
      <input
        className="nm-hero-sub nm-structure-input"
        value={node.attrs.subtitle ?? ""}
        placeholder="副标题"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ subtitle: event.target.value })}
      />
    </NodeViewWrapper>
  );
}

export function QuoteCardView({ node, updateAttributes, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="section"
      className={cn("nm-quote-card", selected && "nm-structure-selected")}
      data-structure="quote-card"
      style={nmReactStyle(node.attrs)}
    >
      <Chrome label="引用卡" />
      <textarea
        className="nm-quote-text nm-structure-input"
        rows={3}
        value={node.attrs.quote ?? ""}
        placeholder="引用内容"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ quote: event.target.value })}
      />
      <input
        className="nm-quote-cite nm-structure-input"
        value={node.attrs.cite ?? ""}
        placeholder="出处（可选）"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ cite: event.target.value })}
      />
    </NodeViewWrapper>
  );
}

export function StepsView({ node, updateAttributes, selected }: NodeViewProps) {
  const items: StepItem[] = Array.isArray(node.attrs.items) ? node.attrs.items : [];
  const setItems = (next: StepItem[]) => updateAttributes({ items: next });
  return (
    <NodeViewWrapper
      as="section"
      className={cn("nm-steps", selected && "nm-structure-selected")}
      data-structure="steps"
      style={nmReactStyle(node.attrs)}
    >
      <Chrome label="步骤" />
      <ol className="nm-step-list">
        {items.map((item, index) => (
          <li key={index} className="nm-step">
            <span className="nm-step-index">{index + 1}</span>
            <div className="nm-step-fields">
              <input
                className="nm-step-title nm-structure-input"
                value={item.title}
                placeholder="步骤标题"
                onMouseDown={stopPm}
                onKeyDown={stopPm}
                onChange={(event) =>
                  setItems(items.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)))
                }
              />
              <input
                className="nm-step-body nm-structure-input"
                value={item.body}
                placeholder="说明（可选）"
                onMouseDown={stopPm}
                onKeyDown={stopPm}
                onChange={(event) =>
                  setItems(items.map((row, i) => (i === index ? { ...row, body: event.target.value } : row)))
                }
              />
            </div>
            <button
              type="button"
              className="nm-structure-remove"
              onMouseDown={stopPm}
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="nm-structure-add"
        onMouseDown={stopPm}
        onClick={() => setItems([...items, { title: `第${items.length + 1}步`, body: "" }])}
      >
        添加步骤
      </button>
    </NodeViewWrapper>
  );
}

export function CardView({ node, updateAttributes, selected }: NodeViewProps) {
  const variant = (node.attrs.variant as CardVariant) || "plain";
  return (
    <NodeViewWrapper
      as="section"
      className={cn("nm-card", `nm-card-${variant}`, selected && "nm-structure-selected")}
      data-structure="card"
      style={nmReactStyle(node.attrs)}
    >
      <Chrome label="卡片">
        <select
          className="nm-structure-select"
          value={variant}
          onMouseDown={stopPm}
          onKeyDown={stopPm}
          onChange={(event) => updateAttributes({ variant: event.target.value })}
        >
          {CARD_VARIANTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Chrome>
      <input
        className="nm-card-title nm-structure-input"
        value={node.attrs.title ?? ""}
        placeholder="标题"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ title: event.target.value })}
      />
      <NodeViewContent className="nm-card-body" />
      <input
        className="nm-card-footer nm-structure-input"
        value={node.attrs.footer ?? ""}
        placeholder="页脚（可选）"
        onMouseDown={stopPm}
        onKeyDown={stopPm}
        onChange={(event) => updateAttributes({ footer: event.target.value })}
      />
    </NodeViewWrapper>
  );
}
