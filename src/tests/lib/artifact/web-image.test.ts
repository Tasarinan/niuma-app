import { describe, expect, it } from "vitest";
import {
  extractDuckDuckGoVqd,
  formatWebImageHits,
  isAllowedImageUrl,
  parseDuckDuckGoImageResults,
  parseUnsplashPhotoResults,
  parseWikimediaImageResults,
  unsplashAccessKeyFromEnv,
} from "@/lib/artifact/web-image";

describe("web image search", () => {
  it("allows public https image urls and rejects localhost", () => {
    expect(isAllowedImageUrl("https://upload.wikimedia.org/foo.png")).toBe(true);
    expect(isAllowedImageUrl("http://example.com/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://localhost/secret.png")).toBe(false);
    expect(isAllowedImageUrl("http://127.0.0.1/x.png")).toBe(false);
    expect(isAllowedImageUrl("http://192.168.1.8/x.png")).toBe(false);
    expect(isAllowedImageUrl("file:///tmp/a.png")).toBe(false);
  });

  it("reads DuckDuckGo image JSON", () => {
    const hits = parseDuckDuckGoImageResults(
      {
        results: [
          {
            title: "类似封面",
            image: "https://cdn.example.com/cover.jpg",
            url: "https://example.com/post",
          },
          { title: "内网", image: "http://10.0.0.2/a.png", url: "http://10.0.0.2/" },
        ],
      },
      8,
    );
    expect(hits).toEqual([
      {
        title: "类似封面",
        imageUrl: "https://cdn.example.com/cover.jpg",
        pageUrl: "https://example.com/post",
        via: "duckduckgo",
      },
    ]);
  });

  it("reads Wikimedia Commons search JSON and keeps the license", () => {
    const hits = parseWikimediaImageResults(
      {
        query: {
          pages: {
            "1": {
              title: "File:Notebook.png",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/n.png",
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Notebook.png",
                  extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" } },
                },
              ],
            },
          },
        },
      },
      4,
    );
    expect(hits[0]?.via).toBe("wikimedia");
    expect(hits[0]?.license).toBe("CC BY-SA 4.0");
    expect(hits[0]?.title).toBe("Notebook.png");
  });

  it("reads Unsplash search JSON with photographer credit", () => {
    const hits = parseUnsplashPhotoResults(
      {
        results: [
          {
            alt_description: "laptop on a wooden desk",
            urls: { regular: "https://images.unsplash.com/photo-abc?w=1080" },
            links: { html: "https://unsplash.com/photos/abc" },
            user: { name: "Ada Lovelace" },
          },
        ],
      },
      8,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.via).toBe("unsplash");
    expect(hits[0]?.imageUrl).toContain("images.unsplash.com");
    expect(hits[0]?.pageUrl).toContain("utm_source=niuma-app");
    expect(hits[0]?.license).toContain("Photo by Ada Lovelace");
  });

  it("reads UNSPLASH_ACCESS_KEY from env without exposing other secrets", () => {
    expect(unsplashAccessKeyFromEnv({ UNSPLASH_ACCESS_KEY: "abc123" })).toBe("abc123");
    expect(unsplashAccessKeyFromEnv({ IMA_API_KEY: "nope" })).toBe("");
  });

  it("extracts a vqd token from DuckDuckGo HTML", () => {
    expect(extractDuckDuckGoVqd(`<script>vqd='3-111-222';</script>`)).toBe("3-111-222");
  });

  it("formats hits for the illustrator tool", () => {
    const text = formatWebImageHits([
      {
        title: "白板",
        imageUrl: "https://upload.wikimedia.org/w.png",
        pageUrl: "https://commons.wikimedia.org/wiki/File:W.png",
        via: "wikimedia",
        license: "CC0",
      },
    ]);
    expect(text).toContain("image: https://upload.wikimedia.org/w.png");
    expect(text).toContain("via: wikimedia · CC0");
  });
});
