import { describe, expect, it } from "vitest";
import { migrateHiredAgentFiles } from "./hired-agents.storage";

describe("hired catalog migration", () => {
  it("maps retired specialists onto the merged catalog files", () => {
    expect(
      migrateHiredAgentFiles([
        "assistant.md",
        "bob.md",
        "charlie.md",
        "kai.md",
        "frank.md",
      ]).sort(),
    ).toEqual(["alice.md", "assistant.md", "atlas.md", "dev.md"]);
  });
});
