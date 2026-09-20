/** Slash commands that start a content workflow, not a pipeline step. */

export type ContentPlatform = "wechat" | "xhs" | "zhihu";

export function normalizeCommandName(name: string): string {
  return name.trim().toLowerCase();
}

export function isNewArticleCommand(name: string): boolean {
  return normalizeCommandName(name) === "new";
}

export function isResumeArticleCommand(name: string): boolean {
  return normalizeCommandName(name) === "resume";
}

export function isEditArticleCommand(name: string): boolean {
  return normalizeCommandName(name) === "edit";
}

export function isFormatCommand(name: string): boolean {
  return normalizeCommandName(name) === "format";
}

/** @deprecated Command /xhs was removed; keep the export so old callers compile. */
export function isXhsStubCommand(_name: string): boolean {
  return false;
}

/** @deprecated Use isNewArticleCommand. Kept so old tests/callers compile during rename. */
export function isWechatWorkflowCommand(name: string): boolean {
  return isNewArticleCommand(name);
}

export function isStubWorkflowCommand(name: string): boolean {
  return isXhsStubCommand(name);
}

export function isContentWorkflowCommand(name: string): boolean {
  return isNewArticleCommand(name) || isResumeArticleCommand(name);
}

/** Slash command that 发行 owns: push to a platform draft box. */
export function isPublishWorkflowCommand(name: string): boolean {
  return normalizeCommandName(name) === "publish";
}

export function parseContentPlatform(args: string): ContentPlatform | undefined {
  const first = args.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return undefined;
  if (first === "wechat" || first === "wx" || first === "gzh" || first === "微信") return "wechat";
  if (first === "xhs" || first === "xiaohongshu" || first === "小红书") return "xhs";
  if (first === "zhihu" || first === "知乎") return "zhihu";
  return undefined;
}

export function splitPlatformAndRest(args: string): { platform?: ContentPlatform; rest: string } {
  const trimmed = args.trim();
  const platform = parseContentPlatform(trimmed);
  if (!platform) return { rest: trimmed };
  const rest = trimmed.split(/\s+/).slice(1).join(" ");
  return { platform, rest };
}

/**
 * Free-text or slash format/publish requests that must skip 主理人
 * and go straight to 发行.
 */
export function isAssistantPublishRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const slash = trimmed.match(/^\/([A-Za-z0-9_-]+)\b/);
  if (slash) {
    if (isContentWorkflowCommand(slash[1]) || isEditArticleCommand(slash[1])) return false;
    return isPublishWorkflowCommand(slash[1]) || isFormatCommand(slash[1]);
  }
  return /(发布|排版|发到公众号|推送到公众号|生成\s*html|转\s*html)/i.test(trimmed);
}

export function shouldInjectWechatSlots(command: string | undefined, args: string): boolean {
  if (!command || !isPublishWorkflowCommand(command)) return false;
  return parseContentPlatform(args) === "wechat";
}
