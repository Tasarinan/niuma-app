import { describe, expect, it } from "vitest";
import {
  imageMimeFromPath,
  isPathInsideWorkspace,
  normalizeFsPath,
  resolveWorkspacePath,
} from "./workspace-path";

describe("workspace-path", () => {
  it("strips Windows extended-length prefixes so writes can use forward slashes", () => {
    const drafts = String.raw`\\?\C:\userdata\testbed\gitrepo\assistant\niuma-app\.artifacts\drafts`;
    expect(normalizeFsPath(drafts)).toBe(
      "C:/userdata/testbed/gitrepo/assistant/niuma-app/.artifacts/drafts",
    );
    expect(normalizeFsPath(`${drafts}/.niuma.keep`)).toBe(
      "C:/userdata/testbed/gitrepo/assistant/niuma-app/.artifacts/drafts/.niuma.keep",
    );
    expect(normalizeFsPath("//?/C:/niuma/.artifacts/drafts/topic/article.md")).toBe(
      "C:/niuma/.artifacts/drafts/topic/article.md",
    );
  });

  it("strips Windows \\\\?\\ prefixes before joining", () => {
    expect(
      resolveWorkspacePath(
        "\\\\?\\C:\\userdata\\niuma-app",
        ".niuma/teams/content/skills/article-formatting-wechat/references/presets/themes/wechat-tech.yaml",
      ),
    ).toBe(
      "C:/userdata/niuma-app/.niuma/teams/content/skills/article-formatting-wechat/references/presets/themes/wechat-tech.yaml",
    );
  });

  it("keeps absolute paths and collapses parent segments", () => {
    expect(resolveWorkspacePath("C:/proj", "C:/proj/.artifacts/drafts/a/imgs/../cover.png")).toBe(
      "C:/proj/.artifacts/drafts/a/cover.png",
    );
  });

  it("rejects paths that escape the workspace", () => {
    const escaped = resolveWorkspacePath("C:/proj", "../outside.png");
    expect(escaped).toBe("C:/outside.png");
    expect(isPathInsideWorkspace("C:/proj", escaped)).toBe(false);
    expect(isPathInsideWorkspace("C:/proj", "C:/proj/.artifacts/imgs/01.png")).toBe(true);
  });

  it("picks an image mime from the file extension", () => {
    expect(imageMimeFromPath("cover.png")).toBe("image/png");
    expect(imageMimeFromPath("ref.JPEG")).toBe("image/jpeg");
    expect(imageMimeFromPath("HRSh1uMboAAPsIX.jfif")).toBe("image/jpeg");
    expect(imageMimeFromPath("a/b.webp")).toBe("image/webp");
  });
});
