import { describe, expect, it } from "vitest";
import {
  CONTENT_ROLE_OWNERSHIP,
  duplicatedCommands,
  duplicatedSkillSlugs,
  formatContentDispatchInstruction,
  formatContentRosterForDispatch,
  isContentProducer,
  resolveContentRouteTarget,
} from "./role-ownership";

describe("content role ownership", () => {
  it("gives each skill slug to exactly one agent", () => {
    expect(duplicatedSkillSlugs()).toEqual([]);
  });

  it("gives each command to exactly one agent", () => {
    expect(duplicatedCommands()).toEqual([]);
  });

  it("keeps 主理人 on workflow commands and 小助理 on publish commands", () => {
    const producer = CONTENT_ROLE_OWNERSHIP.find((role) => role.name === "主理人");
    const assistant = CONTENT_ROLE_OWNERSHIP.find((role) => role.name === "小助理");
    expect(producer?.commands).toEqual(["wechat", "xhs", "blog"]);
    expect(producer?.skills).toEqual(["wechat-article-main", "xhs-main", "blog-main"]);
    expect(assistant?.commands).toEqual(["publish", "ready", "layout"]);
    expect(assistant?.skills).toContain("wechat-article-formatting");
    expect(assistant?.skills).toContain("wechat-article-publish");
  });

  it("does not let 灵感大师 share 小蜜蜂's topics skill", () => {
    const director = CONTENT_ROLE_OWNERSHIP.find((role) => role.name === "灵感大师");
    const bee = CONTENT_ROLE_OWNERSHIP.find((role) => role.name === "小蜜蜂");
    expect(director?.skills).toEqual([]);
    expect(bee?.skills).toEqual(["wechat-article-topics"]);
  });

  it("tells the dispatcher not to do another role's skill", () => {
    const text = formatContentRosterForDispatch("主理人");
    expect(text).toContain("写手");
    expect(text).toContain("wechat-article-writing");
    expect(text).toContain("你是 主理人");
    expect(text).not.toContain("ROUTE: @写手");
  });

  it("lets only 主理人 route out and others escalate back", () => {
    const agents = [{ id: "1", name: "主理人" }, { id: "2", name: "写手" }];
    expect(
      resolveContentRouteTarget("主理人", "写手", agents)?.name,
    ).toBe("写手");
    expect(resolveContentRouteTarget("主理人", "主理人", agents)).toBeNull();
    expect(
      resolveContentRouteTarget("写手", "主理人", agents)?.name,
    ).toBe("主理人");
    expect(resolveContentRouteTarget("写手", "配图师", agents)).toBeNull();
    expect(formatContentDispatchInstruction("写手")).toContain("ROUTE: @主理人");
    expect(formatContentDispatchInstruction("主理人")).toContain("只有你能把任务分给");
    expect(isContentProducer("主理人")).toBe(true);
  });
});
