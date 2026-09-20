import { describe, expect, it } from "vitest";
import {
  DRAFT_ARTICLE_FILENAME,
  isDraftArticleFile,
  isOpenableDraftMarkdown,
  relativeDraftArticlePath,
  resolveOpenDraftPath,
  normalizeDraftPath,
  displayPathUnderDrafts,
  toDraftArticlePath,
  sameManuscriptPath,
  requireConfirmedDraftPath,
  requireOpenableDraftMarkdown,
  toDraftSlug,
  formatDraftTodayContext,
} from "./drafts";

const DAY = new Date(2026, 8, 3); // 2026-09-03 local

describe("content draft paths", () => {
  it("injects today's YYYYMMDD for new folders, not the skill example date", () => {
    const text = formatDraftTodayContext(new Date(2026, 8, 17));
    expect(text).toContain("[今天] 20260917");
    expect(text).toContain("20260917-主题");
    expect(text).not.toContain("20260903");
  });

  it("names a new draft folder as YYYYMMDD-topic", () => {
    expect(toDraftSlug("AI 对内容创作的影响", DAY)).toBe("20260903-ai-对内容创作的影响");
    expect(relativeDraftArticlePath("AI 对内容创作的影响", DAY)).toBe(
      `20260903-ai-对内容创作的影响/${DRAFT_ARTICLE_FILENAME}`,
    );
  });

  it("does not double-prefix a title that already starts with YYYYMMDD-", () => {
    expect(toDraftSlug("20260902-ai-agent-productization", DAY)).toBe(
      "20260902-ai-agent-productization",
    );
  });

  it("treats article.md as the co-edit source even under nested draft folders", () => {
    expect(isDraftArticleFile(".artifacts/drafts/20260903-topic/article.md")).toBe(true);
    expect(isDraftArticleFile("C:\\\\niuma\\\\.artifacts\\\\drafts\\\\slug\\\\article.md")).toBe(true);
    expect(isDraftArticleFile("brief.md")).toBe(false);
    expect(isDraftArticleFile("article.html")).toBe(false);
  });

  it("falls back to untitled when the title is empty", () => {
    expect(toDraftSlug("   ", DAY)).toBe("20260903-untitled");
  });

  it("refuses to create a draft folder before the topic is confirmed", () => {
    expect(() => requireConfirmedDraftPath(undefined)).toThrow(/\/new/);
    expect(requireConfirmedDraftPath("C:/drafts/20260903-topic/article.md")).toBe(
      "C:/drafts/20260903-topic/article.md",
    );
  });

  it("only opens Markdown that already lives under a confirmed draft folder", () => {
    expect(isOpenableDraftMarkdown(".artifacts/drafts/20260903-topic/article.md")).toBe(true);
    expect(isOpenableDraftMarkdown("C:/niuma/.artifacts/drafts/slug/review.md")).toBe(true);
    expect(isOpenableDraftMarkdown(String.raw`C:\niuma\.artifacts\drafts\slug\review.md`)).toBe(true);
    expect(isOpenableDraftMarkdown("article.md")).toBe(false);
    expect(
      isOpenableDraftMarkdown(
        String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`,
      ),
    ).toBe(false);
    expect(() => requireOpenableDraftMarkdown(undefined)).toThrow(/\/new/);
    expect(() => requireOpenableDraftMarkdown("notes.md")).toThrow(/Markdown/);
  });

  it("keeps the confirmed draft path and ignores leftover untitled-article.md", () => {
    const draft = "C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/article.md";
    const leftover = String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`;
    expect(resolveOpenDraftPath(leftover, draft)).toBe(draft);
    expect(resolveOpenDraftPath(leftover)).toBeUndefined();
    expect(resolveOpenDraftPath(draft, leftover)).toBe(draft);
  });

  it("strips Windows \\\\?\\ prefixes and repairs a missing slash before .artifacts", () => {
    const extended = String.raw`\\?\C:\userdata\testbed\gitrepo\assistant\niuma-app\.artifacts\drafts\20260902-claude-51-de-ai-wei\draft.md`;
    const mangled = String.raw`\?\C:\userdata\testbed\gitrepo\assistant\niuma-app.artifacts\drafts\20260902-claude-51-de-ai-wei\draft.md`;
    expect(normalizeDraftPath(extended)).toBe(
      "C:/userdata/testbed/gitrepo/assistant/niuma-app/.artifacts/drafts/20260902-claude-51-de-ai-wei/draft.md",
    );
    expect(normalizeDraftPath(mangled)).toBe(
      "C:/userdata/testbed/gitrepo/assistant/niuma-app/.artifacts/drafts/20260902-claude-51-de-ai-wei/draft.md",
    );
    expect(isOpenableDraftMarkdown(mangled)).toBe(true);
    expect(toDraftArticlePath(mangled)).toBe(
      "C:/userdata/testbed/gitrepo/assistant/niuma-app/.artifacts/drafts/20260902-claude-51-de-ai-wei/article.md",
    );
    expect(
      toDraftArticlePath(
        "C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/topic.md",
      ),
    ).toBe("C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/article.md");
    expect(
      sameManuscriptPath(
        "C:/niuma/.artifacts/drafts/20260903-ai-builder-财富自由/topic.md",
        String.raw`C:\niuma\.artifacts\drafts\20260903-ai-builder-财富自由\article.md`,
      ),
    ).toBe(true);
    expect(
      sameManuscriptPath(
        "C:/niuma/.artifacts/drafts/20260903-old/article.md",
        "C:/niuma/.artifacts/drafts/20260906-new/article.md",
      ),
    ).toBe(false);
  });

  it("shows folder/filename relative to drafts", () => {
    expect(
      displayPathUnderDrafts("C:/niuma/.artifacts/drafts/20260903-ai-native-编辑部/article.md"),
    ).toBe("20260903-ai-native-编辑部/article.md");
    expect(
      displayPathUnderDrafts(String.raw`C:\niuma\.artifacts\drafts\slug\article.md`),
    ).toBe("slug/article.md");
    expect(displayPathUnderDrafts(undefined)).toBeNull();
    expect(displayPathUnderDrafts("notes.md")).toBeNull();
  });
});
