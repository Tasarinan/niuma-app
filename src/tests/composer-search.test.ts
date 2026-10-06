import { describe, expect, it } from "vitest";
import {
  formatWebSearchHits,
  searchQueryFromComposerInput,
} from "@/lib/chat/composer-search";

describe("searchQueryFromComposerInput", () => {
  it("uses the typed question as the search query", () => {
    expect(searchQueryFromComposerInput("今天北京天气")).toBe("今天北京天气");
  });

  it("strips slash commands so /ask 今天北京天气 searches the question", () => {
    expect(searchQueryFromComposerInput("/ask 今天北京天气")).toBe("今天北京天气");
  });

  it("returns empty when a slash command has no arguments", () => {
    expect(searchQueryFromComposerInput("/draft")).toBe("");
  });
});

describe("formatWebSearchHits", () => {
  it("formats numbered title, snippet, and url lines", () => {
    expect(
      formatWebSearchHits([
        { title: "Alpha", url: "https://a.example", snippet: "first" },
        { title: "Beta", url: "https://b.example", snippet: "" },
      ])
    ).toBe("1. Alpha\n   first\n   https://a.example\n\n2. Beta\n   https://b.example");
  });
});
