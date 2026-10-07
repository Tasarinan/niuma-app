import { describe, expect, it } from "vitest";
import {
  formatSessionTurn,
  memoryDir,
  memoryTeamSegment,
  mergeSessionLog,
  sessionDayKey,
} from "@/lib/agent/memory/file-memory";

describe("team memory paths", () => {
  it("stores a team under .artifacts/memory/<team>", () => {
    expect(memoryTeamSegment("content")).toBe("content");
    expect(memoryTeamSegment("..\\content")).toBe("content");
    expect(memoryDir("C:/repo", "content").replace(/\\/g, "/")).toBe(
      "C:/repo/.artifacts/memory/content",
    );
  });

  it("appends a turn to the local day's session log", () => {
    const at = new Date(2026, 9, 7, 22, 18, 4);
    expect(sessionDayKey(at)).toBe("20261007");
    const block = formatSessionTurn({
      at,
      channelName: "内容创作",
      userText: "写一篇周报",
      replies: [{ agentName: "主理人", content: "已记下选题。" }],
    });
    expect(block).toContain("## 22:18:04 · 内容创作");
    expect(block).toContain("**用户**");
    expect(block).toContain("写一篇周报");
    expect(block).toContain("**主理人**");

    const first = mergeSessionLog("", "2026-10-07", block);
    expect(first.startsWith("# 2026-10-07\n")).toBe(true);
    const second = mergeSessionLog(first, "2026-10-07", "## 22:20:00 · 内容创作");
    expect(second).toContain("写一篇周报");
    expect(second).toContain("## 22:20:00 · 内容创作");
  });
});
