import { describe, expect, it } from "vitest";
import {
  consolidateDraftImages,
  rewriteMarkdownImageRefsAligned,
} from "@/lib/artifact/consolidate-draft-images";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe("consolidate draft images", () => {
  it("aligns alt text with imgs filename", () => {
    const out = rewriteMarkdownImageRefsAligned(
      "![Version.png](imgs/01.png)\n",
      () => ({ src: "imgs/workbuddy-01.png", alt: "workbuddy-01.png" }),
    );
    expect(out).toBe("![workbuddy-01.png](imgs/workbuddy-01.png)\n");
  });

  it("moves root screenshots into themed imgs and fixes bare src", async () => {
    const folder = "C:/niuma/.artifacts/drafts/20260918-workbuddy-办公搭子还是付费陷阱";
    const articlePath = `${folder}/article.md`;
    const files = new Map<string, Uint8Array | string>([
      [
        articlePath,
        [
          "![Version.png](imgs/01.png)",
          "![openclaw.png](imgs/workbuddy-01.png)",
          "![Screenshot](01.png)",
        ].join("\n\n"),
      ],
      [`${folder}/imgs/01.png`, PNG_HEADER],
      [`${folder}/imgs/workbuddy-01.png`, PNG_HEADER],
      [`${folder}/Screenshot loose.png`, JPEG_HEADER],
      [`${folder}/01.png`, PNG_HEADER],
    ]);

    const readBase64 = async (path: string) => {
      const value = files.get(path.replace(/\\/g, "/"));
      if (value instanceof Uint8Array) {
        return btoa(String.fromCharCode(...value));
      }
      return "";
    };

    const removed: string[] = [];
    const result = await consolidateDraftImages({
      articlePath,
      readText: async (path) => String(files.get(path.replace(/\\/g, "/")) ?? ""),
      writeText: async (path, content) => {
        files.set(path.replace(/\\/g, "/"), content);
      },
      readBase64,
      writeBytes: async (path, bytes) => {
        files.set(path.replace(/\\/g, "/"), bytes);
      },
      removeFile: async (path) => {
        removed.push(path.replace(/\\/g, "/"));
        files.delete(path.replace(/\\/g, "/"));
      },
      listDirectory: async (path) => {
        const dir = path.replace(/\\/g, "/");
        if (dir === folder) {
          return [
            { name: "article.md", path: articlePath, isDir: false },
            { name: "imgs", path: `${folder}/imgs`, isDir: true },
            { name: "Screenshot loose.png", path: `${folder}/Screenshot loose.png`, isDir: false },
            { name: "01.png", path: `${folder}/01.png`, isDir: false },
          ];
        }
        if (dir.endsWith("/imgs")) {
          return [
            { name: "01.png", path: `${folder}/imgs/01.png`, isDir: false },
            { name: "workbuddy-01.png", path: `${folder}/imgs/workbuddy-01.png`, isDir: false },
          ];
        }
        return [];
      },
      encodePng: async (bytes) => (bytes[0] === 0x89 ? bytes : PNG_HEADER),
    });

    const article = String(files.get(articlePath));
    expect(article).toContain("![workbuddy-01.png](imgs/workbuddy-01.png)");
    expect(article).not.toContain("![Version.png](imgs/01.png)");
    expect(article).not.toMatch(/]\(01\.png\)/);
    expect(result.themeSlug).toBe("workbuddy");
    expect(result.written.length).toBeGreaterThan(0);
    expect(removed).toContain(`${folder}/01.png`);
    expect(removed.some((path) => path.includes("Screenshot loose.png"))).toBe(true);
    expect(files.has(`${folder}/01.png`)).toBe(false);
  });
});
