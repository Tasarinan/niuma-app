/** Per-block typography. Inline CSS beats theme stylesheets and theme inline defaults. */

export type TextAlign = "left" | "center" | "right" | "justify";
export type ShadowLevel = "none" | "sm" | "md" | "lg";
export type BorderStyle = "none" | "solid" | "dashed" | "dotted";

export type BlockStyle = {
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlign;
  indent?: number;
  color?: string;
  background?: string;
  borderRadius?: number;
  boxShadow?: ShadowLevel;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: BorderStyle;
};

export const BLOCK_STYLE_KEYS = [
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "indent",
  "color",
  "background",
  "borderRadius",
  "boxShadow",
  "borderWidth",
  "borderColor",
  "borderStyle",
] as const;

const SHADOW_CSS: Record<Exclude<ShadowLevel, "none">, string> = {
  sm: "0 1px 2px rgba(0,0,0,.08)",
  md: "0 4px 12px rgba(0,0,0,.1)",
  lg: "0 8px 24px rgba(0,0,0,.12)",
};

export const EMPTY_BLOCK_STYLE: BlockStyle = {};

export function isBlockStyleKey(key: string): key is keyof BlockStyle {
  return (BLOCK_STYLE_KEYS as readonly string[]).includes(key);
}

export function compactBlockStyle(style: BlockStyle | null | undefined): BlockStyle | null {
  if (!style) return null;
  const out: BlockStyle = {};
  for (const key of BLOCK_STYLE_KEYS) {
    const value = style[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "boxShadow" && value === "none") continue;
    if (key === "borderStyle" && value === "none") continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

export function blockStyleToCss(style: BlockStyle | null | undefined): string {
  const compact = compactBlockStyle(style);
  if (!compact) return "";
  const decls: string[] = [];
  if (compact.fontSize != null) decls.push(`font-size: ${compact.fontSize}px`);
  if (compact.lineHeight != null) decls.push(`line-height: ${compact.lineHeight}`);
  if (compact.letterSpacing != null) decls.push(`letter-spacing: ${compact.letterSpacing}px`);
  if (compact.textAlign) decls.push(`text-align: ${compact.textAlign}`);
  if (compact.indent != null) decls.push(`padding-left: ${compact.indent}px`);
  if (compact.color) decls.push(`color: ${compact.color}`);
  if (compact.background) decls.push(`background: ${compact.background}`);
  if (compact.borderRadius != null) decls.push(`border-radius: ${compact.borderRadius}px`);
  if (compact.boxShadow && compact.boxShadow !== "none") decls.push(`box-shadow: ${SHADOW_CSS[compact.boxShadow]}`);
  const borderStyle = compact.borderStyle && compact.borderStyle !== "none" ? compact.borderStyle : null;
  if (borderStyle) {
    decls.push(`border-style: ${borderStyle}`);
    decls.push(`border-width: ${compact.borderWidth ?? 1}px`);
    if (compact.borderColor) decls.push(`border-color: ${compact.borderColor}`);
  }
  return decls.join("; ");
}

export function parseCssToBlockStyle(css: string): BlockStyle {
  const style: BlockStyle = {};
  for (const part of css.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const prop = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim().replace(/\s*!important$/i, "").trim();
    if (!prop || !value) continue;
    if (prop === "font-size") style.fontSize = parsePx(value);
    else if (prop === "line-height") style.lineHeight = Number.parseFloat(value);
    else if (prop === "letter-spacing") style.letterSpacing = parsePx(value);
    else if (prop === "text-align" && isAlign(value)) style.textAlign = value;
    else if (prop === "padding-left") style.indent = parsePx(value);
    else if (prop === "color") style.color = value;
    else if (prop === "background" || prop === "background-color") style.background = value;
    else if (prop === "border-radius") style.borderRadius = parsePx(value);
    else if (prop === "box-shadow") style.boxShadow = shadowFromCss(value);
    else if (prop === "border-style" && isBorderStyle(value)) style.borderStyle = value;
    else if (prop === "border-width") style.borderWidth = parsePx(value);
    else if (prop === "border-color") style.borderColor = value;
    else if (prop === "border") {
      const width = value.match(/([\d.]+)px/);
      if (width) style.borderWidth = Number.parseFloat(width[1]);
      if (/dashed/i.test(value)) style.borderStyle = "dashed";
      else if (/dotted/i.test(value)) style.borderStyle = "dotted";
      else if (/solid/i.test(value)) style.borderStyle = "solid";
      const color = value.match(/(#(?:[0-9a-f]{3}|[0-9a-f]{6})|rgba?\([^)]+\))/i);
      if (color) style.borderColor = color[1];
    }
  }
  return compactBlockStyle(style) ?? {};
}

export function mergeCss(base: string, override: string): string {
  const map = new Map<string, string>();
  for (const source of [base, override]) {
    for (const part of source.split(";")) {
      const index = part.indexOf(":");
      if (index < 0) continue;
      const prop = part.slice(0, index).trim().toLowerCase();
      const value = part.slice(index + 1).trim().replace(/\s*!important$/i, "").trim();
      if (prop && value) map.set(prop, value);
    }
  }
  return [...map.entries()].map(([prop, value]) => `${prop}: ${value}`).join("; ");
}

export function stripImportant(css: string): string {
  return css.replace(/\s*!important/gi, "");
}

export function blockStyleFromFields(fields: Record<string, string>): BlockStyle | null {
  const style: BlockStyle = {};
  if (fields.fontSize) style.fontSize = Number.parseFloat(fields.fontSize);
  if (fields.lineHeight) style.lineHeight = Number.parseFloat(fields.lineHeight);
  if (fields.letterSpacing) style.letterSpacing = Number.parseFloat(fields.letterSpacing);
  if (fields.textAlign && isAlign(fields.textAlign)) style.textAlign = fields.textAlign;
  if (fields.indent) style.indent = Number.parseFloat(fields.indent);
  if (fields.color) style.color = fields.color;
  if (fields.background) style.background = fields.background;
  if (fields.borderRadius) style.borderRadius = Number.parseFloat(fields.borderRadius);
  if (fields.boxShadow && isShadow(fields.boxShadow)) style.boxShadow = fields.boxShadow;
  if (fields.borderWidth) style.borderWidth = Number.parseFloat(fields.borderWidth);
  if (fields.borderColor) style.borderColor = fields.borderColor;
  if (fields.borderStyle && isBorderStyle(fields.borderStyle)) style.borderStyle = fields.borderStyle;
  return compactBlockStyle(style);
}

export function blockStyleToFields(style: BlockStyle | null | undefined): Record<string, string> {
  const compact = compactBlockStyle(style);
  if (!compact) return {};
  const fields: Record<string, string> = {};
  for (const key of BLOCK_STYLE_KEYS) {
    const value = compact[key];
    if (value === undefined || value === null) continue;
    fields[key] = String(value);
  }
  return fields;
}

export function applyStyleAttr(html: string, css: string): string {
  if (!css) return html;
  const merged = (existing: string) => mergeCss(existing, css);
  if (/\sstyle="/i.test(html)) {
    return html.replace(/\sstyle="([^"]*)"/i, (_, current) => ` style="${escapeAttr(merged(current))}"`);
  }
  return html.replace(/^<([a-zA-Z0-9-]+)/, `<$1 style="${escapeAttr(css)}"`);
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function parsePx(value: string): number | undefined {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
}

function isAlign(value: string): value is TextAlign {
  return value === "left" || value === "center" || value === "right" || value === "justify";
}

function isShadow(value: string): value is ShadowLevel {
  return value === "none" || value === "sm" || value === "md" || value === "lg";
}

function isBorderStyle(value: string): value is BorderStyle {
  return value === "none" || value === "solid" || value === "dashed" || value === "dotted";
}

function shadowFromCss(value: string): ShadowLevel | undefined {
  if (!value || value === "none") return "none";
  if (value.includes("24px")) return "lg";
  if (value.includes("12px")) return "md";
  if (value.includes("2px")) return "sm";
  return "md";
}
