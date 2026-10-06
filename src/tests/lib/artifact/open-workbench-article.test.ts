import { describe, expect, it, vi } from "vitest";
import {
  DRAFT_FILE_CHANGED_EVENT,
  OPEN_WORKBENCH_ARTICLE_EVENT,
  notifyDraftFileChanged,
  requestOpenWorkbenchArticle,
  subscribeDraftFileChanged,
  subscribeOpenWorkbenchArticle,
} from "@/lib/artifact/open-workbench-article";

describe("open workbench article event", () => {
  it("dispatches on window without switching the workbench to 编辑", () => {
    const handler = vi.fn();
    const stop = subscribeOpenWorkbenchArticle(handler);
    requestOpenWorkbenchArticle({
      filePath: "C:/niuma/.niuma/artifacts/drafts/20260903-topic/article.md",
      focus: "images",
    });
    expect(handler).toHaveBeenCalledWith({
      filePath: "C:/niuma/.niuma/artifacts/drafts/20260903-topic/article.md",
      focus: "images",
    });
    expect(handler.mock.calls[0][0].switchView).toBeUndefined();
    stop();
  });

  it("uses a stable event name the workbench already listens for", () => {
    expect(OPEN_WORKBENCH_ARTICLE_EVENT).toBe("niuma:open-workbench-article");
  });

  it("notifies the editor when a draft file changes on disk", () => {
    const handler = vi.fn();
    const stop = subscribeDraftFileChanged(handler);
    notifyDraftFileChanged("C:/niuma/.niuma/artifacts/drafts/20260903-topic/article.md");
    expect(handler).toHaveBeenCalledWith({
      filePath: "C:/niuma/.niuma/artifacts/drafts/20260903-topic/article.md",
    });
    expect(DRAFT_FILE_CHANGED_EVENT).toBe("niuma:draft-file-changed");
    stop();
  });
});
