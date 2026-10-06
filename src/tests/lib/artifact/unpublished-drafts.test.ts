import { describe, expect, it } from "vitest";
import {
  formatUnpublishedDraftsContext,
  isPublishedMarker,
  matchUnpublishedDrafts,
  titleFromTopicOrFolder,
  toUnpublishedDraft,
  pickDefaultDraftOpenPath,
  displayTitleForDraftFile,
  applyMarkdownTitle,
  isPlaceholderArticleTitle,
  selectOpenArticle,
} from "@/lib/artifact/unpublished-drafts";

const wealth = toUnpublishedDraft({
  folder: "20260903-ai-builder-财富自由",
  dirPath: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-builder-财富自由",
  fileNames: ["topic.md", "article.md", "imgs"],
  articlePath: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-builder-财富自由/article.md",
  topicPath: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-builder-财富自由/topic.md",
  topicMarkdown: "# AI 时代：别人用 AI 搞钱，我用 AI 做产品却没人看\n",
})!;

describe("unpublished drafts", () => {
  it("keeps confirmed folders that are not marked published", () => {
    expect(isPublishedMarker("published.md")).toBe(true);
    expect(toUnpublishedDraft({
      folder: "done",
      dirPath: "/drafts/done",
      fileNames: ["article.md", "published.md"],
      articlePath: "/drafts/done/article.md",
    })).toBeNull();
    expect(wealth?.title).toContain("AI 时代");
    expect(wealth?.articlePath).toContain("article.md");
  });

  it("matches a continue query against folder or title", () => {
    expect(matchUnpublishedDrafts("财富自由", [wealth])).toEqual([wealth]);
    expect(matchUnpublishedDrafts("搞钱", [wealth])).toEqual([wealth]);
    expect(matchUnpublishedDrafts("小红书", [wealth])).toEqual([]);
  });

  it("tells the host to resume instead of opening a new topic", () => {
    const text = formatUnpublishedDraftsContext([wealth], "财富自由");
    expect(text).toContain("[未推送草稿]");
    expect(text).toContain("intent: continue");
    expect(text).toContain("不要再 mkdir");
    expect(text).toContain("本次请直接继续");
    expect(text).toContain("article.md");
    expect(text).toContain("不要替用户切换到编辑栏");
    expect(text).toContain("点「编辑」");
    expect(text).toContain("review.md");
    expect(text).toContain("不要创建 `.niuma-article/`");
    expect(text).not.toContain("打开该篇");
  });

  it("forbids resume when intent is a new topic even if the query matches", () => {
    const text = formatUnpublishedDraftsContext([wealth], "财富自由", "create");
    expect(text).toContain("intent: create");
    expect(text).toContain("禁止续写");
    expect(text).toContain("对照（禁止续写）");
    expect(text).not.toContain("本次请直接继续");
    expect(text).not.toContain("本次参数匹配到一篇");
  });

  it("falls back to the folder slug when topic.md has no heading", () => {
    expect(titleFromTopicOrFolder("", "20260903-ai-builder-财富自由")).toBe("ai-builder-财富自由");
  });

  it("opens the newest unpublished article.md by default", () => {
    expect(pickDefaultDraftOpenPath([])).toBeUndefined();
    expect(pickDefaultDraftOpenPath([wealth])).toBe(wealth.articlePath);
    expect(
      pickDefaultDraftOpenPath([
        {
          ...wealth,
          folder: "20260904-newer",
          articlePath: undefined,
          topicPath: "C:/niuma/.niuma/artifacts/drafts/20260904-newer/topic.md",
        },
        wealth,
      ]),
    ).toBe("C:/niuma/.niuma/artifacts/drafts/20260904-newer/topic.md");
  });

  it("uses the manuscript heading instead of Untitled or article.md", () => {
    expect(displayTitleForDraftFile("/d/20260903-ai-builder-财富自由/article.md", "")).toBe("ai-builder-财富自由");
    expect(
      displayTitleForDraftFile(
        "/d/20260903-ai-builder-财富自由/article.md",
        "# 别人用 AI 印钞，我用 AI 印障纸\n\n正文",
      ),
    ).toBe("别人用 AI 印钞，我用 AI 印障纸");
    expect(isPlaceholderArticleTitle("Untitled Article")).toBe(true);
    expect(isPlaceholderArticleTitle("未命名文章")).toBe(true);
    expect(isPlaceholderArticleTitle("别人用 AI 印钞，我用 AI 印障纸")).toBe(false);
  });

  it("updates or inserts the first H1 when saving a title", () => {
    expect(applyMarkdownTitle("# 旧标题\n\n正文", "新标题")).toBe("# 新标题\n\n正文");
    expect(applyMarkdownTitle("正文", "新标题")).toBe("# 新标题\n\n正文");
    expect(applyMarkdownTitle("", "新标题")).toBe("# 新标题\n");
  });

  it("does not fall back to leftover untitled-article.md", () => {
    const leftover = {
      id: "old",
      filePath: String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`,
    };
    const draft = {
      id: wealth.articlePath!,
      filePath: wealth.articlePath,
    };
    expect(selectOpenArticle([leftover, draft], leftover.id)).toEqual(draft);
    expect(selectOpenArticle([leftover], leftover.id)).toBeNull();
  });

  it("opens article.md even if the stored id is topic.md or draft.md", () => {
    const topic = {
      id: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-builder-财富自由/topic.md",
      filePath: "C:/niuma/.niuma/artifacts/drafts/20260903-ai-builder-财富自由/topic.md",
    };
    const article = {
      id: wealth.articlePath!,
      filePath: wealth.articlePath,
    };
    expect(selectOpenArticle([topic, article], topic.id)).toEqual(article);
  });

  it("does not keep showing the previous manuscript while a new draft path is loading", () => {
    const previous = {
      id: "C:/niuma/.niuma/artifacts/drafts/20260903-old/article.md",
      filePath: "C:/niuma/.niuma/artifacts/drafts/20260903-old/article.md",
    };
    const nextPath = "C:/niuma/.niuma/artifacts/drafts/20260906-new/article.md";
    expect(selectOpenArticle([previous], nextPath)).toBeNull();
  });
});
