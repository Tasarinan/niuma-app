import { describe, expect, it } from "vitest";
import {
  buildScrapCollectCliArgs,
  formatScrapCollectForPrompt,
  parseScrapCollectStdout,
} from "@/lib/content/scrap-collect";

describe("scrap-collect", () => {
  it("parses JSON from noisy stdout", () => {
    const payload = parseScrapCollectStdout('log line\n{"items":[{"title":"A"}],"failed":[]}\n');
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items?.[0].title).toBe("A");
  });

  it("builds fast collect args by default", () => {
    const args = buildScrapCollectCliArgs({
      sources: ["general"],
      urls: [],
      keywords: ["GPT"],
      count: 24,
    });
    expect(args).toContain("--sources");
    expect(args).toContain("general");
    expect(args).toContain("--keyword");
    expect(args).toContain("GPT");
    expect(args).toContain("--deep");
    expect(args).toContain("--no-playwright");
    expect(args).toContain("--count");
    expect(args).toContain("24");
  });

  it("formats prompt block telling agent not to re-run collect", () => {
    const text = formatScrapCollectForPrompt(
      { items: [{ title: "Hello", url: "https://x", content: "body" }] },
      ".artifacts/scraps/2026-01-01/collect.json",
    );
    expect(text).toContain("不要再次运行 collect.py");
    expect(text).toContain("collect.json");
    expect(text).toContain("Hello");
  });
});
