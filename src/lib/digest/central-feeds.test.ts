import { describe, expect, it } from "vitest";
import {
  compactCentralFeeds,
  feedMirrorUrls,
  formatDigestFeedContext,
  isDigestCommand,
  loadCentralFeeds,
} from "./central-feeds";

const RAW_X = "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json";

describe("follow-builders feed mirrors", () => {
  it("tries jsDelivr before GitHub raw", () => {
    const urls = feedMirrorUrls(RAW_X);
    expect(urls[0]).toBe("https://cdn.jsdelivr.net/gh/zarazhangrui/follow-builders@main/feed-x.json");
    expect(urls.at(-1)).toBe(RAW_X);
  });

  it("identifies /digest as the command that should inject feeds", () => {
    expect(isDigestCommand("digest")).toBe(true);
    expect(isDigestCommand("topic")).toBe(false);
  });
});

describe("compact and format", () => {
  it("keeps only items that already have a URL", () => {
    const compact = compactCentralFeeds({
      x: {
        x: [
          {
            name: "Ada",
            handle: "ada",
            tweets: [
              { text: "shipped", url: "https://x.com/ada/1", createdAt: "2026-09-01T00:00:00.000Z" },
              { text: "no link" },
            ],
          },
        ],
      },
      podcasts: {
        podcasts: [{ title: "Ep 1", url: "https://example.com/ep1", summary: "notes" }],
      },
      blogs: {
        blogs: [{ title: "Post", url: "" }],
      },
    });
    expect(compact.x).toEqual([
      {
        kind: "x",
        author: "Ada",
        handle: "ada",
        text: "shipped",
        url: "https://x.com/ada/1",
        at: "2026-09-01T00:00:00.000Z",
      },
    ]);
    expect(compact.podcasts).toHaveLength(1);
    expect(compact.blogs).toHaveLength(0);
  });

  it("tells the agent to remix the injected feed and not fetch again", () => {
    const text = formatDigestFeedContext({
      status: "ok",
      x: [{ kind: "x", author: "Ada", handle: "ada", text: "shipped", url: "https://x.com/ada/1" }],
      podcasts: [],
      blogs: [],
      errors: [],
    });
    expect(text).toContain("https://x.com/ada/1");
    expect(text).toContain("不要再运行");
    expect(text).toContain("prepare-digest.mjs");
    expect(text).toContain("禁止发明");
  });

  it("surfaces a visible error when every mirror fails", () => {
    const text = formatDigestFeedContext({
      status: "error",
      x: [],
      podcasts: [],
      blogs: [],
      errors: ["Could not fetch tweet feed"],
    });
    expect(text).toContain("Could not fetch tweet feed");
    expect(text).toContain("不要编造");
  });
});

describe("loadCentralFeeds", () => {
  it("uses the first mirror that returns JSON", async () => {
    const attempted: string[] = [];
    const pack = await loadCentralFeeds({
      fetchImpl: async (input) => {
        const url = String(input);
        attempted.push(url);
        if (url.includes("cdn.jsdelivr.net") && url.endsWith("feed-x.json")) {
          return new Response(JSON.stringify({ x: [{ name: "Ada", handle: "ada", tweets: [{ text: "hi", url: "https://x.com/a/1" }] }] }), {
            status: 200,
          });
        }
        if (url.includes("cdn.jsdelivr.net")) {
          return new Response(JSON.stringify({ podcasts: [], blogs: [] }), { status: 200 });
        }
        throw new Error("should not hit github");
      },
    });
    expect(pack.status).toBe("ok");
    expect(pack.x[0]?.url).toBe("https://x.com/a/1");
    expect(attempted.some((u) => u.includes("raw.githubusercontent.com"))).toBe(false);
  });

  it("falls back to the next mirror after a timeout", async () => {
    const pack = await loadCentralFeeds({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("cdn.jsdelivr.net")) {
          throw new Error("timeout");
        }
        if (url.endsWith("feed-x.json")) {
          return new Response(JSON.stringify({ x: [{ name: "Ada", handle: "ada", tweets: [{ text: "hi", url: "https://x.com/a/1" }] }] }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      },
    });
    expect(pack.x).toHaveLength(1);
  });
});
