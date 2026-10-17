import { describe, expect, it } from "vitest";
import { buildScrapInboxMarkdown, scrapsInboxDirForDay } from "@/lib/content/scraps-inbox";

describe("scraps-inbox", () => {
  it("builds inbox path under daily scraps", () => {
    expect(scrapsInboxDirForDay("2026-10-16")).toBe(".artifacts/scraps/2026-10-16/inbox");
  });

  it("builds markdown with front matter", () => {
    const md = buildScrapInboxMarkdown({
      kind: "clip",
      clipType: "idea",
      body: "hello",
      entryId: "e1",
    });
    expect(md).toContain("kind: clip");
    expect(md).toContain("clip_type: idea");
    expect(md).toContain("entry_id: e1");
    expect(md).toContain("hello");
  });
});
