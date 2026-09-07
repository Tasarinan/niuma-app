/** Slash commands that start a content workflow, not a pipeline step. */

export function isWechatWorkflowCommand(name: string): boolean {
  return name.trim().toLowerCase() === "wechat";
}

export function isStubWorkflowCommand(name: string): boolean {
  const command = name.trim().toLowerCase();
  return command === "xhs" || command === "blog";
}

export function isContentWorkflowCommand(name: string): boolean {
  return isWechatWorkflowCommand(name) || isStubWorkflowCommand(name);
}

/** Slash commands that 小助理 owns: layout / publish, not 主理人. */
export function isPublishWorkflowCommand(name: string): boolean {
  const command = name.trim().toLowerCase();
  return command === "publish" || command === "ready" || command === "layout";
}

/**
 * Free-text or slash publish/layout requests that must skip 主理人
 * and go straight to 小助理.
 */
export function isAssistantPublishRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const slash = trimmed.match(/^\/([A-Za-z0-9_-]+)\b/);
  if (slash) {
    if (isWechatWorkflowCommand(slash[1]) || isStubWorkflowCommand(slash[1])) return false;
    return isPublishWorkflowCommand(slash[1]);
  }
  return /(发布|排版|发到公众号|推送到公众号|生成\s*html|转\s*html)/i.test(trimmed);
}
