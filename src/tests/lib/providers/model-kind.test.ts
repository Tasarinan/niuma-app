import { describe, expect, it } from "vitest";
import {
  classifyModelKind,
  ensureSelectedModel,
  partitionModels,
  uniqueModelIds,
} from "@/lib/providers/model-kind";

describe("provider model kind", () => {
  it("splits Agnes chat / image / video ids", () => {
    expect(classifyModelKind("agnes-2.5-flash")).toBe("text");
    expect(classifyModelKind("agnes-image-2.5-flash")).toBe("image");
    expect(classifyModelKind("agnes-video-v2.0")).toBe("video");
  });

  it("partitions a mixed /models payload", () => {
    expect(
      partitionModels([
        "agnes-2.5-flash",
        "agnes-image-2.5-flash",
        "agnes-video-v2.0",
        "gpt-4o",
      ]),
    ).toEqual({
      text: ["agnes-2.5-flash", "gpt-4o"],
      image: ["agnes-image-2.5-flash"],
      video: ["agnes-video-v2.0"],
    });
  });

  it("keeps suggested ids in front and preserves a custom selection", () => {
    expect(uniqueModelIds(["agnes-2.5-flash"], ["agnes-2.5-flash", "other"])).toEqual([
      "agnes-2.5-flash",
      "other",
    ]);
    expect(ensureSelectedModel(["a", "b"], "custom")).toEqual(["custom", "a", "b"]);
  });
});
