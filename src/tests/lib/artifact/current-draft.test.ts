import { describe, expect, it } from "vitest";
import {
  currentDraftPickerOptions,
  formatCurrentDraftContext,
  isBindableDraftMarkdown,
  locateDraftMarkdownPath,
  shouldOpenBoundDraft,
} from "@/lib/artifact/current-draft";

describe("current co-creation draft", () => {
  it("resolves a relative draft path against the workspace root", () => {
    expect(
      locateDraftMarkdownPath(
        "C:/niuma",
        ".niuma/artifacts/drafts/20260917-workbuddy-本地配置/article.md",
      ),
    ).toBe("C:/niuma/.niuma/artifacts/drafts/20260917-workbuddy-本地配置/article.md");
  });

  it("keeps an already-absolute draft path", () => {
    const abs = "C:/niuma/.niuma/artifacts/drafts/20260917-workbuddy-本地配置/topic.md";
    expect(locateDraftMarkdownPath("C:/niuma", abs)).toBe(
      "C:/niuma/.niuma/artifacts/drafts/20260917-workbuddy-本地配置/topic.md",
    );
  });

  it("binds article.md and topic.md under drafts, not prompt dumps", () => {
    expect(isBindableDraftMarkdown(".niuma/artifacts/drafts/20260917-x/article.md")).toBe(true);
    expect(isBindableDraftMarkdown(".niuma/artifacts/drafts/20260917-x/topic.md")).toBe(true);
    expect(isBindableDraftMarkdown(".niuma/artifacts/drafts/20260917-x/review.md")).toBe(true);
    expect(isBindableDraftMarkdown(".niuma/artifacts/drafts/20260917-x/imgs/prompts/01.md")).toBe(false);
  });

  it("tells the agent the bound folder is what 编辑 will open", () => {
    const text = formatCurrentDraftContext(
      "C:/niuma/.niuma/artifacts/drafts/20260917-workbuddy-本地配置/article.md",
    );
    expect(text).toContain("[当前共创目录]");
    expect(text).toContain("20260917-workbuddy-本地配置/article.md");
    expect(text).toContain("open_article");
  });

  it("reopens the editor only when the bound manuscript changes", () => {
    expect(
      shouldOpenBoundDraft(
        "C:/niuma/.niuma/artifacts/drafts/a/article.md",
        "C:/niuma/.niuma/artifacts/drafts/a/topic.md",
      ),
    ).toBe(false);
    expect(
      shouldOpenBoundDraft(
        "C:/niuma/.niuma/artifacts/drafts/a/article.md",
        "C:/niuma/.niuma/artifacts/drafts/b/article.md",
      ),
    ).toBe(true);
    expect(shouldOpenBoundDraft(undefined, "C:/niuma/.niuma/artifacts/drafts/b/article.md")).toBe(true);
  });

  it("lists unpublished drafts for the editor switcher", () => {
    expect(
      currentDraftPickerOptions([
        {
          folder: "20260917-workbuddy-本地配置",
          title: "WorkBuddy",
          articlePath: "C:/d/20260917-workbuddy-本地配置/article.md",
        },
        {
          folder: "20260903-old",
          title: "旧稿",
          topicPath: "C:/d/20260903-old/topic.md",
        },
      ]),
    ).toEqual([
      {
        value: "C:/d/20260917-workbuddy-本地配置/article.md",
        label: "20260917-workbuddy-本地配置 · WorkBuddy",
      },
      {
        value: "C:/d/20260903-old/topic.md",
        label: "20260903-old · 旧稿",
      },
    ]);
  });
});
