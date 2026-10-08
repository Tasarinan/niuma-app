import { describe, expect, it } from "vitest";
import { draftDirFromArticlePath } from "@/lib/content/wechat-draft-pipeline";

describe("wechat-draft-pipeline", () => {
  it("resolves draft folder from article.md path", () => {
    const folder = draftDirFromArticlePath(
      "C:/ws/.artifacts/drafts/20261007-topic/article.md",
    );
    expect(folder?.replace(/\\/g, "/")).toContain(".artifacts/drafts/20261007-topic");
  });
});
