import type { CSSProperties } from "react";
import { stripImportant } from "./block-style";

/** Parse format.py theme YAML and turn CSS strings into preview styles. */

export const DEFAULT_THEME_VARIABLES: Record<string, string> = {
  "primary-color": "#0F4C81",
  "bg-accent-color": "#F0F4F8",
  "text-color": "#333333",
  "text-light": "#666666",
  "text-muted": "#999999",
  "bg-light": "#F7F7F7",
  "border-color": "#EEEEEE",
  "link-color": "#576B95",
  "font-size": "16px",
  "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "line-height": "1.8",
  "paragraph-spacing": "1.5em",
};

export type ParsedFormatTheme = {
  name: string;
  variables: Record<string, string>;
  styles: Record<string, string>;
};

export function unquoteYamlScalar(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.replace(/^"|"$/g, "").replace(/\\"/g, '"');
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseIndentedMap(raw: string, header: string): Record<string, string> {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^${header}:\\s*(?:#.*)?$`).test(line));
  if (start < 0) return {};
  const out: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^[ \t]/.test(line)) break;
    const match = line.match(/^[ \t]+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) break;
    out[match[1]] = unquoteYamlScalar(match[2]);
  }
  return out;
}

export function parseFormatThemeYaml(raw: string): ParsedFormatTheme {
  const nameLine = raw.replace(/\r\n/g, "\n").split("\n").find((line) => /^name:\s*/.test(line));
  const name = nameLine ? unquoteYamlScalar(nameLine.replace(/^name:\s*/, "")) : "";
  return {
    name,
    variables: parseIndentedMap(raw, "variables"),
    styles: parseIndentedMap(raw, "styles"),
  };
}

export function resolveThemePlaceholders(template: string, variables: Record<string, string>): string {
  let result = template;
  for (let i = 0; i < 3; i++) {
    for (const [key, value] of Object.entries(variables)) {
      result = result.split(`{${key}}`).join(value);
    }
  }
  return result;
}

export function buildResolvedStyles(theme: ParsedFormatTheme): Record<string, string> {
  const variables: Record<string, string> = { ...DEFAULT_THEME_VARIABLES, ...theme.variables };
  const resolvedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    resolvedVars[key] = resolveThemePlaceholders(value, variables);
  }
  const out: Record<string, string> = { ...resolvedVars };
  for (const [key, value] of Object.entries(theme.styles)) {
    out[key] = resolveThemePlaceholders(value, out).replace(/"/g, "'");
  }
  return out;
}

export function cssTextToStyle(css: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const part of css.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const prop = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim().replace(/\s*!important$/i, "").trim();
    if (!prop || !value) continue;
    const camel = prop.replace(/-([a-z])/gi, (_, letter: string) => letter.toUpperCase());
    style[camel] = value;
  }
  return style as CSSProperties;
}

export function fallbackContainerCss(styles: Record<string, string>): string {
  return [
    `font-family:${styles["font-family"] || "sans-serif"}`,
    `font-size:${styles["font-size"] || "16px"}`,
    `line-height:${styles["line-height"] || "1.8"}`,
    `color:${styles["text-color"] || "#333333"}`,
    "padding:16px",
    "text-align:left",
    "background-color:#ffffff",
  ].join("; ");
}

const THEME_ELEMENT_KEYS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "img",
  "table",
  "th",
  "td",
  "tr",
  "code",
  "pre",
  "figcaption",
] as const;

export function themeStylesToScopedCss(scope: string, styles: Record<string, string>): string {
  const rules: string[] = [
    `${scope} { ${stripImportant(styles.container?.trim() || fallbackContainerCss(styles))} }`,
    `${scope} * { box-sizing: border-box; }`,
    `${scope} ul { list-style-type: disc; }`,
    `${scope} ol { list-style-type: decimal; }`,
    `${scope} img { max-width: 100%; height: auto; display: block; }`,
  ];
  for (const key of THEME_ELEMENT_KEYS) {
    const css = styles[key]?.trim();
    if (!css) continue;
    rules.push(`${scope} ${key} { ${stripImportant(css.replace(/<\/style/gi, ""))} }`);
  }
  return rules.join("\n");
}
