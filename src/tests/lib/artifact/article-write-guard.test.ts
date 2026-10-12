import { describe, expect, it } from "vitest";
import { diskWriteDecision, normalizeArticleText } from "@/lib/artifact/article-write-guard";

describe("article write guard", () => {
  it("treats CRLF and LF as the same baseline", () => {
    expect(normalizeArticleText("a\r\nb")).toBe("a\nb");
    expect(
      diskWriteDecision({
        fileExists: true,
        diskContent: "段落\r\n",
        baselineContent: "段落\n",
      }),
    ).toBe("write");
  });

  it("refuses to overwrite a disk copy that moved", () => {
    expect(
      diskWriteDecision({
        fileExists: true,
        diskContent: "agent 改过的稿",
        baselineContent: "打开时的稿",
      }),
    ).toBe("conflict");
  });

  it("writes a missing file and writes again after the user keeps their copy", () => {
    expect(
      diskWriteDecision({
        fileExists: false,
        diskContent: "",
        baselineContent: "打开时的稿",
      }),
    ).toBe("write");
    expect(
      diskWriteDecision({
        fileExists: true,
        diskContent: "agent 改过的稿",
        baselineContent: "打开时的稿",
        adoptDisk: true,
      }),
    ).toBe("write");
  });
});
