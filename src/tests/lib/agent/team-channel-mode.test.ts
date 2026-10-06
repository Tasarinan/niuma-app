import { describe, expect, it } from "vitest";
import {
  channelKindFromTeam,
  isMeetingChannel,
  resolveTeamChannelMode,
  usesManuscriptWorkspace,
} from "@/lib/agent/team-channel-mode";

describe("team channel mode", () => {
  it("binds predefined UIs from team.yaml view", () => {
    expect(resolveTeamChannelMode({ view: "chat" })).toBe("chat");
    expect(resolveTeamChannelMode({ view: "editor" })).toBe("editor");
    expect(resolveTeamChannelMode({ view: "meeting" })).toBe("meeting");
    expect(resolveTeamChannelMode({ view: "health" })).toBe("health");
  });

  it("falls back to workflow / workspaceRoot when view is omitted", () => {
    expect(resolveTeamChannelMode({ workflow: "study" })).toBe("chat");
    expect(resolveTeamChannelMode({ workflow: "content", workspaceRoot: true })).toBe("editor");
    expect(resolveTeamChannelMode({ workflow: "meeting" })).toBe("meeting");
    expect(resolveTeamChannelMode({ workflow: "health" })).toBe("health");
  });

  it("does not need a separate channel type field when the team is bound", () => {
    expect(channelKindFromTeam({ view: "meeting" })).toBe("meeting");
    expect(channelKindFromTeam({ view: "editor" })).toBe("chat");
    expect(isMeetingChannel({ view: "meeting" }, "chat")).toBe(true);
    expect(isMeetingChannel({ view: "editor" }, "meeting")).toBe(false);
    expect(isMeetingChannel(undefined, "meeting")).toBe(true);
  });

  it("only the editor view owns manuscript draft context", () => {
    expect(usesManuscriptWorkspace("editor")).toBe(true);
    expect(usesManuscriptWorkspace("chat")).toBe(false);
    expect(usesManuscriptWorkspace("meeting")).toBe(false);
    expect(usesManuscriptWorkspace("health")).toBe(false);
  });
});
