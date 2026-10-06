/** Slash commands that start a content workflow, not a pipeline step. */

import {
  hasFamilyCommand,
  type ContentWorkflowCommands,
} from "@/lib/content/roster-workflow";

export type ContentPlatform = "wechat" | "xhs" | "zhihu";

/** Sub-actions for `/article`, similar to `/record` types or `/profile` actions. */
export type ArticleCommandAction = "create" | "edit" | "delete" | "update";

export function normalizeCommandName(name: string): string {
  return name.trim().toLowerCase();
}

export function isArticleCommand(name: string, commands?: ContentWorkflowCommands): boolean {
  return hasFamilyCommand(commands, "draft", name);
}

const ARTICLE_ACTION_ALIASES: Record<string, ArticleCommandAction> = {
  create: "create",
  new: "create",
  edit: "edit",
  delete: "delete",
  remove: "delete",
  update: "update",
  modify: "update",
};

export function parseArticleCommandArgs(args: string): {
  action?: ArticleCommandAction;
  rest: string;
} {
  const trimmed = args.trim();
  if (!trimmed) return { rest: "" };
  const [first, ...restParts] = trimmed.split(/\s+/);
  const action = ARTICLE_ACTION_ALIASES[first.toLowerCase()];
  if (action) return { action, rest: restParts.join(" ") };
  return { rest: trimmed };
}

export type ArticleDraftWorkflowIntent = "create" | "continue";

/**
 * Draft workflow injection in chat: create = roundtable (/article create),
 * continue = pick an existing draft (/article edit <which>).
 */
export function resolveArticleDraftWorkflow(
  command: string,
  args: string,
  commands?: ContentWorkflowCommands,
): { intent: ArticleDraftWorkflowIntent; query: string } | null {
  const name = normalizeCommandName(command);
  if (name === "new") return { intent: "create", query: args.trim() };
  if (name === "resume") return { intent: "continue", query: args.trim() };
  if (!isArticleCommand(name, commands)) return null;

  const { action, rest } = parseArticleCommandArgs(args);
  if (action === "create") return { intent: "create", query: rest.trim() };
  if (action === "edit" && rest.trim()) return { intent: "continue", query: rest.trim() };
  return null;
}

/** UI-only: open workbench editor bar (no agent turn). */
export function isArticleEditUiCommand(
  command: string,
  args: string,
  commands?: ContentWorkflowCommands,
): boolean {
  const name = normalizeCommandName(command);
  if (name === "edit" && !args.trim()) return true;
  if (!isArticleCommand(name, commands)) return false;
  const { action, rest } = parseArticleCommandArgs(args);
  return action === "edit" && !rest.trim();
}

/** @deprecated Use resolveArticleDraftWorkflow(...)?.intent === "create". */
export function isNewArticleCommand(name: string, args = ""): boolean {
  return resolveArticleDraftWorkflow(name, args)?.intent === "create";
}

/** @deprecated Use resolveArticleDraftWorkflow(...)?.intent === "continue". */
export function isResumeArticleCommand(name: string, args = ""): boolean {
  return resolveArticleDraftWorkflow(name, args)?.intent === "continue";
}

/** @deprecated Use isArticleEditUiCommand. */
export function isEditArticleCommand(name: string, args = ""): boolean {
  return isArticleEditUiCommand(name, args);
}

export function isFormatCommand(name: string, commands?: ContentWorkflowCommands): boolean {
  return hasFamilyCommand(commands, "format", name);
}

export function isImageCommand(name: string, commands?: ContentWorkflowCommands): boolean {
  return hasFamilyCommand(commands, "image", name);
}

/** @deprecated Use isNewArticleCommand. Kept so old tests/callers compile during rename. */
export function isWechatWorkflowCommand(name: string): boolean {
  return isNewArticleCommand(name);
}

export function isStubWorkflowCommand(name: string): boolean {
  return isXhsStubCommand(name);
}

/** @deprecated Command /xhs was removed; keep the export so old callers compile. */
export function isXhsStubCommand(_name: string): boolean {
  return false;
}

export function isContentWorkflowCommand(
  name: string,
  args = "",
  commands?: ContentWorkflowCommands,
): boolean {
  return resolveArticleDraftWorkflow(name, args, commands) !== null;
}

/** Slash command owned by the publish-skill role: push to a platform draft box. */
export function isPublishWorkflowCommand(name: string, commands?: ContentWorkflowCommands): boolean {
  return hasFamilyCommand(commands, "publish", name);
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
 * Free-text or slash format/publish/image requests that skip the host
 * and go to the role that owns that command family.
 */
export function isAssistantPublishRequest(text: string, commands?: ContentWorkflowCommands): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const slash = trimmed.match(/^\/([A-Za-z0-9_-]+)\b(?:\s+([\s\S]*))?$/);
  if (slash) {
    const cmd = slash[1];
    const args = slash[2] ?? "";
    if (isContentWorkflowCommand(cmd, args, commands) || isArticleEditUiCommand(cmd, args, commands)) {
      return false;
    }
    if (isArticleCommand(cmd, commands)) {
      const { action } = parseArticleCommandArgs(args);
      if (action === "delete" || action === "update") return false;
    }
    return (
      isPublishWorkflowCommand(cmd, commands) ||
      isFormatCommand(cmd, commands) ||
      isImageCommand(cmd, commands)
    );
  }
  return /(发布|排版|发到公众号|推送到公众号|生成\s*html|转\s*html)/i.test(trimmed);
}

export function shouldInjectWechatSlots(
  command: string | undefined,
  args: string,
  commands?: ContentWorkflowCommands,
): boolean {
  if (!command || !isPublishWorkflowCommand(command, commands)) return false;
  return parseContentPlatform(args) === "wechat";
}
