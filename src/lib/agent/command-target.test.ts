import { describe, expect, it } from "vitest";
import {
  agentMatchesCommandTarget,
  missingCommandAgentMessage,
  selectAgentsForCommand,
  shouldSmartDispatch,
} from "./command-target";

const bee = {
  id: "1",
  name: "微信选题员",
  role: "信息采集",
  description: "digest",
};
const writer = {
  id: "2",
  name: "写手",
  role: "撰稿",
  description: "",
};

describe("command agent routing", () => {
  it("routes /wechat to 主理人", () => {
    const host = { id: "0", name: "主理人", role: "主题人" };
    expect(agentMatchesCommandTarget(host, "主理人")).toBe(true);
    expect(agentMatchesCommandTarget(host, "主题人")).toBe(true);
    expect(selectAgentsForCommand([host, writer], ["主理人"]).map((a) => a.id)).toEqual(["0"]);
  });

  it("routes 小蜜蜂 to a hired agent still named 微信选题员", () => {
    expect(agentMatchesCommandTarget(bee, "小蜜蜂")).toBe(true);
    expect(selectAgentsForCommand([bee, writer], ["小蜜蜂"]).map((a) => a.id)).toEqual(["1"]);
  });

  it("matches the current catalog name and wechat-researcher file stem", () => {
    expect(agentMatchesCommandTarget({ name: "小蜜蜂", role: "信息采集" }, "小蜜蜂")).toBe(true);
    expect(agentMatchesCommandTarget({ name: "小蜜蜂", role: "信息采集" }, "wechat-researcher")).toBe(true);
  });

  it("does not send /wechat to unrelated channel members", () => {
    expect(agentMatchesCommandTarget(writer, "小蜜蜂")).toBe(false);
    expect(selectAgentsForCommand([writer], ["小蜜蜂"])).toEqual([]);
  });

  it("explains when the routed agent is not in the channel", () => {
    expect(missingCommandAgentMessage(["主理人"])).toContain("主理人");
    expect(missingCommandAgentMessage(["主理人"])).toContain("/wechat");
  });

  it("routes /ready's 小助理 to a hired publisher still named 微信发布", () => {
    expect(
      agentMatchesCommandTarget({ name: "微信发布", role: "排版与发布" }, "小助理"),
    ).toBe(true);
  });

  it("does not smart-dispatch when /publish targets 小助理", () => {
    const host = { id: "0", name: "主理人", role: "主题人" };
    const assistant = { id: "9", name: "小助理", role: "排版与发布" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, assistant],
        targetAgentNames: ["小助理"],
        mentionCount: 0,
      }),
    ).toBe(false);
    expect(selectAgentsForCommand([host, assistant], ["小助理"]).map((a) => a.id)).toEqual(["9"]);
  });

  it("keeps smart dispatch when /wechat targets the first channel member", () => {
    const host = { id: "0", name: "主理人", role: "主题人" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, writer, bee],
        targetAgentNames: ["主理人"],
        mentionCount: 0,
      }),
    ).toBe(true);
  });

  it("does not smart-dispatch when the user @mentions someone", () => {
    const host = { id: "0", name: "主理人", role: "主题人" };
    expect(
      shouldSmartDispatch({
        channelAgents: [host, writer],
        targetAgentNames: ["主理人"],
        mentionCount: 1,
      }),
    ).toBe(false);
  });
});
