import { describe, expect, it } from "vitest";
import {
  agentAvatarGlyph,
  isAgentAvatarImage,
  preferAgentAvatar,
} from "@/lib/agent/agent-avatar";

describe("isAgentAvatarImage", () => {
  it("accepts bundled and remote image urls", () => {
    expect(isAgentAvatarImage("/assets/talent_icon-abc.jpeg")).toBe(true);
    expect(isAgentAvatarImage("https://example.com/a.png")).toBe(true);
    expect(isAgentAvatarImage("tauri://localhost/asset")).toBe(true);
    expect(isAgentAvatarImage("content/assets/talent_icon/foo.png")).toBe(true);
    expect(isAgentAvatarImage("assets/talent_icon-abc.jpeg")).toBe(true);
  });

  it("rejects emoji and empty", () => {
    expect(isAgentAvatarImage("🧑‍💻")).toBe(false);
    expect(isAgentAvatarImage("")).toBe(false);
  });
});

describe("agentAvatarGlyph", () => {
  it("shows emoji when not an image url", () => {
    expect(agentAvatarGlyph("✍️", "Writer")).toBe("✍️");
  });

  it("falls back to label initial for image urls", () => {
    expect(agentAvatarGlyph("/assets/x.png", "Writer")).toBe("W");
  });
});

describe("preferAgentAvatar", () => {
  it("prefers catalog image over stored emoji", () => {
    expect(preferAgentAvatar("✍️", "/assets/icon.png")).toBe("/assets/icon.png");
  });
});
