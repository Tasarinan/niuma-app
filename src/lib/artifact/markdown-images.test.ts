import { describe, expect, it } from "vitest";
import {
  collectMarkdownImageSrcs,
  inlineLocalMarkdownImages,
  localImageReadCandidates,
  markdownHasUnresolvedLocalImages,
  previewUrlTransform,
  relativizeMarkdownImages,
  resolveLocalImagePath,
  resolvePreviewImageSrc,
} from "./markdown-images";

describe("markdown local images", () => {
  it("resolves a sibling file against the article path", () => {
    expect(
      resolveLocalImagePath(
        "C:/niuma/.artifacts/drafts/foo/article.md",
        "HRSh1uMboAAPsIX.jfif",
      ),
    ).toBe("C:/niuma/.artifacts/drafts/foo/HRSh1uMboAAPsIX.jfif");
    expect(resolveLocalImagePath("C:/niuma/.artifacts/drafts/foo/article.md", "imgs/01.png")).toBe(
      "C:/niuma/.artifacts/drafts/foo/imgs/01.png",
    );
    expect(resolveLocalImagePath("C:/niuma/.artifacts/drafts/foo/article.md", "https://cdn/a.png")).toBeNull();
    expect(resolveLocalImagePath("C:/niuma/.artifacts/drafts/foo/article.md", "data:image/png;base64,abc")).toBeNull();
  });

  it("flags relative image srcs that a webview cannot load", () => {
    const markdown = "![封面](HRSh1uMboAAPsIX.jfif)\n\n正文\n\n![图](imgs/01.png)";
    expect(collectMarkdownImageSrcs(markdown)).toEqual(["HRSh1uMboAAPsIX.jfif", "imgs/01.png"]);
    expect(markdownHasUnresolvedLocalImages(markdown)).toBe(true);
    expect(markdownHasUnresolvedLocalImages("![x](data:image/png;base64,abc)")).toBe(false);
  });

  it("turns relative preview srcs into asset urls when an article path is given", () => {
    expect(
      resolvePreviewImageSrc(
        "imgs/cover.png",
        "C:/niuma/.artifacts/drafts/foo/article.md",
        (abs) => `asset://localhost/${abs}`,
      ),
    ).toBe("asset://localhost/C:/niuma/.artifacts/drafts/foo/imgs/cover.png");
    expect(resolvePreviewImageSrc("data:image/png;base64,abc", undefined)).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("keeps data URLs and relative imgs paths for preview", () => {
    expect(previewUrlTransform("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(previewUrlTransform("imgs/cover.png")).toBe("imgs/cover.png");
    expect(previewUrlTransform("javascript:alert(1)")).toBe("");
  });

  it("inlines local files as data URLs and round-trips back to relative srcs", async () => {
    const markdown = "# t\n\n![封面](HRSh1uMboAAPsIX.jfif)\n\n![图](imgs/01.png)\n";
    const files = new Map([
      ["C:/niuma/.artifacts/drafts/foo/HRSh1uMboAAPsIX.jfif", "amZqMQ=="],
      ["C:/niuma/.artifacts/drafts/foo/imgs/01.png", "cG5nMQ=="],
    ]);
    const { markdown: display, srcMap } = await inlineLocalMarkdownImages(
      markdown,
      "C:/niuma/.artifacts/drafts/foo/article.md",
      async (path) => files.get(path) ?? "",
    );
    expect(display).toContain("data:image/jpeg;base64,amZqMQ==");
    expect(display).toContain("data:image/png;base64,cG5nMQ==");
    expect(display).not.toContain("HRSh1uMboAAPsIX.jfif");
    expect(relativizeMarkdownImages(display, srcMap)).toBe(
      "# t\n\n![封面](imgs/foo-01.png)\n\n![图](imgs/01.png)\n",
    );
  });

  it("resolves image paths that contain spaces", () => {
    expect(
      resolveLocalImagePath(
        "C:/niuma/.artifacts/drafts/foo/article.md",
        "imgs/Screenshot 2026-09-07 112646.png",
      ),
    ).toBe("C:/niuma/.artifacts/drafts/foo/imgs/Screenshot 2026-09-07 112646.png");
    expect(collectMarkdownImageSrcs("![图](imgs/Screenshot 2026.png)")).toEqual([
      "imgs/Screenshot 2026.png",
    ]);
  });

  it("inlines local files whose markdown paths contain spaces", async () => {
    const markdown = "![截图](imgs/Screenshot 2026.png)\n";
    const files = new Map([
      ["C:/niuma/.artifacts/drafts/foo/imgs/Screenshot 2026.png", "cG5nMQ=="],
    ]);
    const { markdown: display } = await inlineLocalMarkdownImages(
      markdown,
      "C:/niuma/.artifacts/drafts/foo/article.md",
      async (path) => files.get(path) ?? "",
    );
    expect(display).toContain("data:image/png;base64,cG5nMQ==");
  });

  it("looks for the same file under imgs/", () => {
    expect(localImageReadCandidates("C:/niuma/.artifacts/drafts/foo/cover.png")).toContain(
      "C:/niuma/.artifacts/drafts/foo/imgs/cover.png",
    );
    expect(localImageReadCandidates("C:/niuma/.artifacts/drafts/foo/imgs/01.png")).not.toContain(
      "C:/niuma/.artifacts/drafts/foo/imgs/imgs/01.png",
    );
  });

  it("inlines a sibling jfif when markdown already says .png", async () => {
    const markdown = "![封面](HRSh1uMboAAPsIX.png)\n";
    const files = new Map([["C:/niuma/.artifacts/drafts/foo/HRSh1uMboAAPsIX.jfif", "amZqMQ=="]]);
    const { markdown: display, srcMap } = await inlineLocalMarkdownImages(
      markdown,
      "C:/niuma/.artifacts/drafts/foo/article.md",
      async (path) => files.get(path) ?? "",
    );
    expect(display).toContain("data:image/jpeg;base64,amZqMQ==");
    expect(relativizeMarkdownImages(display, srcMap)).toBe("![封面](imgs/foo-01.png)\n");
  });
});
