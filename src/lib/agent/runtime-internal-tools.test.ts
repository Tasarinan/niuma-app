import { describe, expect, it } from "vitest";
import { mergeRuntimeInternalTools } from "./runtime-internal-tools";

describe("mergeRuntimeInternalTools", () => {
  it("adds generate_image for 配图师 even if stored tools omit it", () => {
    expect(
      mergeRuntimeInternalTools(["bash", "read", "write", "edit", "ls", "open_article"], {
        bridgedSkillCount: 1,
        agentName: "配图师",
        agentRole: "配图",
      }),
    ).toContain("generate_image");
    expect(
      mergeRuntimeInternalTools(["bash", "read", "write", "edit", "ls", "open_article"], {
        bridgedSkillCount: 1,
        agentName: "配图师",
        agentRole: "配图",
      }),
    ).toEqual(expect.arrayContaining(["search_images", "save_web_image"]));
  });

  it("does not add generate_image for the writer", () => {
    expect(
      mergeRuntimeInternalTools(["bash", "read", "write", "edit", "ls", "open_article"], {
        bridgedSkillCount: 1,
        agentName: "写手",
        agentRole: "写作",
      }),
    ).not.toContain("generate_image");
    expect(
      mergeRuntimeInternalTools(["bash", "read", "write", "edit", "ls", "open_article"], {
        bridgedSkillCount: 1,
        agentName: "写手",
        agentRole: "写作",
      }),
    ).not.toContain("search_images");
  });

  it("keeps generate_image when the catalog already enabled it", () => {
    expect(
      mergeRuntimeInternalTools(["generate_image"], {
        bridgedSkillCount: 0,
        agentName: "other",
        agentRole: "",
      }),
    ).toEqual(["generate_image"]);
  });

  it("does not add bash just because skills are bridged", () => {
    expect(
      mergeRuntimeInternalTools(["read"], {
        bridgedSkillCount: 2,
        agentName: "写手",
        agentRole: "写作",
      }),
    ).not.toContain("bash");
  });
});
