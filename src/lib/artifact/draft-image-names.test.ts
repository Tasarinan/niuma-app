import { describe, expect, it } from "vitest";
import {
  draftThemeSlugFromFolder,
  inferImageNameIntent,
  isScreenshotLikeFilename,
  isWechatSafeImageFilename,
  nextWechatImageFilename,
  normalizeWechatImageFilename,
} from "./draft-image-names";

describe("draft image names", () => {
  it("accepts cover, numeric, and theme-prefixed png names", () => {
    expect(isWechatSafeImageFilename("cover.png")).toBe(true);
    expect(isWechatSafeImageFilename("01.png")).toBe(true);
    expect(isWechatSafeImageFilename("ai-native-01.png")).toBe(true);
    expect(isWechatSafeImageFilename("Screenshot 2026.png")).toBe(false);
    expect(isWechatSafeImageFilename("封面.png")).toBe(false);
  });

  it("builds a latin theme slug from the draft folder", () => {
    expect(draftThemeSlugFromFolder("C:/niuma/.artifacts/drafts/20260903-ai-native-编辑部")).toBe(
      "ai-native",
    );
  });

  it("never maps screenshots to cover.png", () => {
    expect(isScreenshotLikeFilename("Screenshot 2026-09-07 112646.png")).toBe(true);
    expect(normalizeWechatImageFilename("Screenshot 2026-09-07.png", [])).toBe("01.png");
    expect(
      normalizeWechatImageFilename("Screenshot 2026-09-07.png", [], { themeSlug: "ai-native" }),
    ).toBe("ai-native-01.png");
    expect(normalizeWechatImageFilename("封面.png", ["cover.png"])).toBe("01.png");
    expect(normalizeWechatImageFilename("cover.png", [], { intent: "cover" })).toBe("cover.png");
  });

  it("allocates the next themed or numeric filename", () => {
    expect(nextWechatImageFilename([], "ai-native")).toBe("ai-native-01.png");
    expect(nextWechatImageFilename(["ai-native-01.png"], "ai-native")).toBe("ai-native-02.png");
    expect(nextWechatImageFilename(["cover.png"])).toBe("01.png");
    expect(inferImageNameIntent("placeholder_cover.png")).toBe("cover");
    expect(inferImageNameIntent("Screenshot.png")).toBe("inline");
  });
});
