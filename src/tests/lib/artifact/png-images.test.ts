import { describe, expect, it } from "vitest";
import {
  ensurePngBytes,
  isPngBytes,
  materializeLocalImagesAsPng,
  preferPngImageEntries,
  rewriteMarkdownLocalImagesToPng,
  toDraftImgsAbsPath,
  toPngPath,
} from "@/lib/artifact/png-images";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe("wechat png images", () => {
  it("rewrites local image paths to wechat-safe png names", () => {
    expect(toPngPath("HRSh1uMboAAPsIX.jfif")).toBe("01.png");
    expect(toPngPath("imgs/cover.jpg", [], { intent: "cover" })).toBe("imgs/cover.png");
    expect(toPngPath("imgs/01.PNG")).toBe("imgs/01.png");
    expect(toPngPath("Screenshot 2026.png", [], { themeSlug: "ai-native" })).toBe(
      "ai-native-01.png",
    );
    expect(
      toDraftImgsAbsPath("C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/HRSh1uMboAAPsIX.jfif"),
    ).toBe("C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/imgs/ai-native-01.png");
    expect(toDraftImgsAbsPath("C:/niuma/.niuma/artifacts/drafts/foo/imgs/cover.jpg")).toBe(
      "C:/niuma/.niuma/artifacts/drafts/foo/imgs/cover.png",
    );
  });

  it("rewrites markdown image srcs to png and leaves remote urls alone", () => {
    const markdown = "![封面](HRSh1uMboAAPsIX.jfif)\n\n![图](imgs/01.jpeg)\n\n![网](https://cdn/a.jpg)\n";
    expect(
      rewriteMarkdownLocalImagesToPng(
        markdown,
        "C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/article.md",
      ),
    ).toBe(
      "![封面](imgs/ai-native-01.png)\n\n![图](imgs/01.png)\n\n![网](https://cdn/a.jpg)\n",
    );
  });

  it("detects png magic bytes", () => {
    expect(isPngBytes(PNG_HEADER)).toBe(true);
    expect(isPngBytes(JPEG_HEADER)).toBe(false);
  });

  it("skips encoding when the file is already png", async () => {
    let encoded = 0;
    const out = await ensurePngBytes(PNG_HEADER, async () => {
      encoded += 1;
      return PNG_HEADER;
    });
    expect(out).toBe(PNG_HEADER);
    expect(encoded).toBe(0);
  });

  it("encodes non-png bytes", async () => {
    const png = await ensurePngBytes(JPEG_HEADER, async () => PNG_HEADER);
    expect(isPngBytes(png)).toBe(true);
  });

  it("writes png siblings and rewrites markdown", async () => {
    const written = new Map<string, Uint8Array>();
    const jpegB64 = btoa(String.fromCharCode(...JPEG_HEADER));
    const result = await materializeLocalImagesAsPng({
      articlePath: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/article.md",
      markdown: "![截图](HRSh1uMboAAPsIX.jfif)\n",
      readBase64: async () => jpegB64,
      writeBytes: async (path, bytes) => {
        written.set(path, bytes);
      },
      encodePng: async () => PNG_HEADER,
    });
    expect(result.markdown).toBe("![截图](imgs/ai-native-01.png)\n");
    expect([...written.keys()]).toEqual([
      "C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/imgs/ai-native-01.png",
    ]);
    expect(
      isPngBytes(
        written.get("C:/niuma/.niuma/artifacts/drafts/20260903-ai-native-编辑部/imgs/ai-native-01.png")!,
      ),
    ).toBe(true);
  });

  it("converts a jfif sibling when markdown already points at png", async () => {
    const written = new Map<string, Uint8Array>();
    const jpegB64 = btoa(String.fromCharCode(...JPEG_HEADER));
    const files = new Map([["C:/niuma/.niuma/artifacts/drafts/foo/HRSh1uMboAAPsIX.jfif", jpegB64]]);
    const result = await materializeLocalImagesAsPng({
      articlePath: "C:/niuma/.niuma/artifacts/drafts/foo/article.md",
      markdown: "![封面](HRSh1uMboAAPsIX.png)\n",
      readBase64: async (path) => files.get(path) ?? "",
      writeBytes: async (path, bytes) => {
        written.set(path, bytes);
      },
      encodePng: async () => PNG_HEADER,
    });
    expect(result.markdown).toBe("![封面](imgs/foo-01.png)\n");
    expect([...written.keys()]).toEqual(["C:/niuma/.niuma/artifacts/drafts/foo/imgs/foo-01.png"]);
  });

  it("hides jpeg/jfif when a png with the same stem exists", () => {
    expect(
      preferPngImageEntries([
        { name: "cover.jfif" },
        { name: "cover.png" },
        { name: "01.png" },
      ]).map((item) => item.name),
    ).toEqual(["cover.png", "01.png"]);
  });
});
