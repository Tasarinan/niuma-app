import { describe, expect, it } from "vitest";
import {
  applyReplacePatch,
  countSubstringOccurrences,
  isReviewStale,
  parseReviewMeta,
  parseReviewSuggestions,
} from "@/lib/content/article-review";

describe("article-review", () => {
  it("parses review.meta.yaml", () => {
    const meta = parseReviewMeta(`
round: 2
status: blocked
reviewed_at: "2026-10-07T12:00:00+08:00"
article_sha256: abcd1234
blocker_count: 1
reviewer: chief
`);
    expect(meta).toEqual({
      round: 2,
      status: "blocked",
      reviewed_at: "2026-10-07T12:00:00+08:00",
      article_sha256: "abcd1234",
      blocker_count: 1,
      reviewer: "chief",
    });
  });

  it("parses review.suggestions.json", () => {
    const file = parseReviewSuggestions(
      JSON.stringify({
        round: 1,
        article_sha256: "aa",
        items: [
          {
            id: "r1-001",
            severity: "blocker",
            category: "typo",
            anchor: "帐号",
            reason: "错别字",
            patch: { type: "replace", old: "帐号", new: "账号" },
          },
        ],
      }),
    );
    expect(file?.items).toHaveLength(1);
    expect(file?.items[0].patch?.new).toBe("账号");
  });

  it("detects stale review when hash differs", () => {
    const meta = parseReviewMeta(`
round: 1
status: blocked
reviewed_at: "2026-10-07T12:00:00+08:00"
article_sha256: oldhash
blocker_count: 0
`);
    expect(isReviewStale(meta, null, "newhash")).toBe(true);
    expect(isReviewStale(meta, null, "oldhash")).toBe(false);
  });

  it("applies replace only when anchor is unique", () => {
    expect(applyReplacePatch("你好帐号", { type: "replace", old: "帐号", new: "账号" }).ok).toBe(true);
    expect(
      applyReplacePatch("帐号和帐号", { type: "replace", old: "帐号", new: "账号" }),
    ).toMatchObject({ ok: false });
    expect(countSubstringOccurrences("aa bb aa", "aa")).toBe(2);
  });
});
