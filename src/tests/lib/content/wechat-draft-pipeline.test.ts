import { describe, expect, it } from "vitest";
import {
  describeWechatPipelineError,
  draftDirFromArticlePath,
} from "@/lib/content/wechat-draft-pipeline";

describe("wechat-draft-pipeline", () => {
  it("resolves draft folder from article.md path", () => {
    const folder = draftDirFromArticlePath(
      "C:/ws/.artifacts/drafts/20261007-topic/article.md",
    );
    expect(folder?.replace(/\\/g, "/")).toContain(".artifacts/drafts/20261007-topic");
  });

  it("explains the Windows Store python3 stub", () => {
    expect(
      describeWechatPipelineError({
        stderr:
          "Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases.",
        exitCode: 9009,
      }),
    ).toContain("微软商店占位程序");
  });
});
