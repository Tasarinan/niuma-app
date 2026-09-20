import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildResolvedStyles,
  cssTextToStyle,
  parseFormatThemeYaml,
  themeStylesToScopedCss,
  unquoteYamlScalar,
} from "./format-theme-css";

describe("format theme CSS", () => {
  it("unquotes JSON-style YAML strings", () => {
    expect(unquoteYamlScalar('"Segoe UI"')).toBe("Segoe UI");
    expect(unquoteYamlScalar('"-apple-system, \\"Segoe UI\\", sans-serif"')).toBe(
      "-apple-system, \"Segoe UI\", sans-serif",
    );
  });

  it("resolves Niuma default.yaml placeholders", () => {
    const raw = readFileSync(
      path.resolve(
        process.cwd(),
        ".niuma/teams/content/skills/article-formatting-wechat/references/presets/themes/default.yaml",
      ),
      "utf8",
    );
    const styles = buildResolvedStyles(parseFormatThemeYaml(raw));
    expect(styles.h2).toContain("#1A6DB5");
    expect(styles.h2).not.toContain("{primary-color}");
    expect(styles.p).toContain("16px");
  });

  it("loads huasheng wechat-tech container and heading styles", () => {
    const raw = readFileSync(
      path.resolve(
        process.cwd(),
        ".niuma/teams/content/skills/article-formatting-wechat/references/presets/themes/wechat-tech.yaml",
      ),
      "utf8",
    );
    const parsed = parseFormatThemeYaml(raw);
    expect(parsed.name).toBe("技术风格");
    const styles = buildResolvedStyles(parsed);
    expect(styles.container).toContain("max-width: 740px");
    expect(styles.h2).toContain("#00a67d");
    expect(styles.container).not.toContain('"Segoe UI"');
    expect(styles.container).toContain("'Segoe UI'");
  });

  it("builds scoped CSS that still carries heading chrome", () => {
    const raw = readFileSync(
      path.resolve(
        process.cwd(),
        ".niuma/teams/content/skills/article-formatting-wechat/references/presets/themes/wechat-tech.yaml",
      ),
      "utf8",
    );
    const css = themeStylesToScopedCss(
      ".wechat-theme-preview",
      buildResolvedStyles(parseFormatThemeYaml(raw)),
    );
    expect(css).toContain(".wechat-theme-preview h2 {");
    expect(css).toContain("#00a67d");
    expect(css).toContain("background-color: #fff");
  });

  it("strips theme !important so block inline styles can win", () => {
    const css = themeStylesToScopedCss(".wechat-theme-preview", {
      p: "font-size: 16px !important; color: #333",
    });
    expect(css).toContain("font-size: 16px");
    expect(css).not.toContain("!important");
  });

  it("converts CSS text to a React style object", () => {
    const style = cssTextToStyle(
      "font-size: 22px; border-left: 5px solid #00a67d !important; background-color: #fff",
    );
    expect(style.fontSize).toBe("22px");
    expect(style.borderLeft).toBe("5px solid #00a67d");
    expect(style.backgroundColor).toBe("#fff");
  });
});
