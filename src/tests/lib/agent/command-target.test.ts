import { describe, expect, it } from "vitest";
import {
  agentMatchesCommandTarget,
  missingCommandAgentMessage,
  selectAgentsForCommand,
  shouldSmartDispatch,
} from "@/lib/agent/command-target";

const desk = {
  id: "1",
  name: "采编",
  role: "选题",
  description: "digest",
};
const writer = {
  id: "2",
  name: "写手",
  role: "撰稿",
  description: "",
};

describe("command agent routing", () => {
  it("routes /article to 主理人", () => {
    const host = { id: "0", name: "主理人", role: "主理人" };
    expect(agentMatchesCommandTarget(host, "主理人")).toBe(true);
    expect(selectAgentsForCommand([host, writer], ["主理人"]).map((a) => a.id)).toEqual(["0"]);
  });

  it("routes 采编 by the current catalog name", () => {
    expect(agentMatchesCommandTarget(desk, "采编")).toBe(true);
    expect(selectAgentsForCommand([desk, writer], ["采编"]).map((a) => a.id)).toEqual(["1"]);
  });

  it("does not send a 采编 command to unrelated channel members", () => {
    expect(agentMatchesCommandTarget(writer, "采编")).toBe(false);
    expect(selectAgentsForCommand([writer], ["采编"])).toEqual([]);
  });

  it("explains when the routed agent is not in the channel", () => {
    expect(missingCommandAgentMessage(["主理人"], "article")).toContain("主理人");
    expect(missingCommandAgentMessage(["主理人"], "article")).toContain("/article");
  });

  it("routes /publish to 发行", () => {
    expect(agentMatchesCommandTarget({ name: "发行", role: "发行" }, "发行")).toBe(true);
  });

  it("does not smart-dispatch when /publish targets 发行", () => {
    const host = { id: "0", name: "主理人", role: "主理人" };
    const publisher = { id: "9", name: "发行", role: "发行" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, publisher],
        targetAgentNames: ["发行"],
        mentionCount: 0,
      }),
    ).toBe(false);
    expect(selectAgentsForCommand([host, publisher], ["发行"]).map((a) => a.id)).toEqual(["9"]);
  });

  it("keeps smart dispatch when /article targets the first channel member", () => {
    const host = { id: "0", name: "主理人", role: "主理人" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, writer, desk],
        targetAgentNames: ["主理人"],
        mentionCount: 0,
      }),
    ).toBe(true);
  });

  it("does not smart-dispatch when the user @mentions someone", () => {
    const host = { id: "0", name: "主理人", role: "主理人" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, writer],
        targetAgentNames: ["主理人"],
        mentionCount: 1,
      }),
    ).toBe(false);
  });
});
