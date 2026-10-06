import { describe, expect, it } from "vitest";
import { shouldSyncShortcutsFromWindow } from "@/lib/storage/shortcuts.storage";

describe("shouldSyncShortcutsFromWindow", () => {
  it("only the main overlay window registers shortcuts at startup", () => {
    expect(shouldSyncShortcutsFromWindow("main")).toBe(true);
  });

  it("dashboard and agent-chat windows do not register at startup", () => {
    expect(shouldSyncShortcutsFromWindow("dashboard")).toBe(false);
    expect(shouldSyncShortcutsFromWindow("agent-chat")).toBe(false);
  });
});
