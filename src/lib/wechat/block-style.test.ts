import { describe, expect, it } from "vitest";
import {
  applyStyleAttr,
  blockStyleFromFields,
  blockStyleToCss,
  compactBlockStyle,
  mergeCss,
  parseCssToBlockStyle,
  stripImportant,
} from "./block-style";

describe("block style", () => {
  it("serializes structured fields to CSS", () => {
    expect(
      blockStyleToCss({
        fontSize: 18,
        textAlign: "center",
        color: "#111111",
      }),
    ).toBe("font-size: 18px; text-align: center; color: #111111");
  });

  it("lets later CSS declarations win when merging", () => {
    expect(mergeCss("font-size: 16px; color: #333", "font-size: 20px")).toBe(
      "font-size: 20px; color: #333",
    );
  });

  it("strips !important so block inline styles can win", () => {
    expect(stripImportant("font-size: 16px !important; color: red")).toBe(
      "font-size: 16px; color: red",
    );
  });

  it("round-trips fence fields", () => {
    const style = compactBlockStyle(
      blockStyleFromFields({ fontSize: "18", textAlign: "center", background: "#EEF4FF" }),
    );
    expect(style).toEqual({ fontSize: 18, textAlign: "center", background: "#EEF4FF" });
    expect(parseCssToBlockStyle(blockStyleToCss(style))).toMatchObject({
      fontSize: 18,
      textAlign: "center",
    });
  });

  it("applies a style attribute onto an opening tag", () => {
    expect(applyStyleAttr('<p style="color: #333">hi</p>', "font-size: 20px")).toContain(
      "font-size: 20px",
    );
    expect(applyStyleAttr("<h2>title</h2>", "font-size: 22px")).toBe(
      '<h2 style="font-size: 22px">title</h2>',
    );
  });
});
