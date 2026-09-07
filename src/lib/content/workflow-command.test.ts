import { describe, expect, it } from "vitest";
import {
  isContentWorkflowCommand,
  isStubWorkflowCommand,
  isWechatWorkflowCommand,
  isPublishWorkflowCommand,
  isAssistantPublishRequest,
} from "./workflow-command";

describe("content workflow commands", () => {
  it("treats /wechat as a workflow start, not a pipeline step", () => {
    expect(isWechatWorkflowCommand("wechat")).toBe(true);
    expect(isWechatWorkflowCommand("WeChat")).toBe(true);
    expect(isWechatWorkflowCommand("digest")).toBe(false);
    expect(isWechatWorkflowCommand("topic")).toBe(false);
  });

  it("treats /xhs and /blog as unconnected workflow shells", () => {
    expect(isStubWorkflowCommand("xhs")).toBe(true);
    expect(isStubWorkflowCommand("blog")).toBe(true);
    expect(isStubWorkflowCommand("wechat")).toBe(false);
  });

  it("groups the three workflow commands", () => {
    expect(isContentWorkflowCommand("wechat")).toBe(true);
    expect(isContentWorkflowCommand("xhs")).toBe(true);
    expect(isContentWorkflowCommand("blog")).toBe(true);
    expect(isContentWorkflowCommand("draft")).toBe(false);
  });

  it("sends publish/layout to 小助理, not 主理人", () => {
    expect(isPublishWorkflowCommand("publish")).toBe(true);
    expect(isPublishWorkflowCommand("ready")).toBe(true);
    expect(isPublishWorkflowCommand("layout")).toBe(true);
    expect(isPublishWorkflowCommand("wechat")).toBe(false);
    expect(isAssistantPublishRequest("/publish")).toBe(true);
    expect(isAssistantPublishRequest("/ready 2")).toBe(true);
    expect(isAssistantPublishRequest("发布到公众号")).toBe(true);
    expect(isAssistantPublishRequest("帮我排版")).toBe(true);
    expect(isAssistantPublishRequest("/wechat 发布一篇")).toBe(false);
    expect(isAssistantPublishRequest("继续写")).toBe(false);
  });
});
