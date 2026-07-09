/**
 * Internal agent tools backed by Tauri commands.
 *
 * - `bash`  → `run_sandboxed_command`
 * - `read` / `write` / `edit` / `ls` / `grep` → `fs_*` commands
 * - `checkpoint` → human approval bridge
 *
 * All tools honour the active sandbox mode. Relative paths resolve under the
 * configured execution root, or under the backend's managed temporary sandbox
 * directory when no workspace was selected.
 * Tools throw on failure (Pi convention) so the loop records an error result.
 */

import { Type } from "@earendil-works/pi-ai";
import type { Static, TSchema } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { AgentInternalToolId, SandboxMode } from "@/types";
import { invoke, textResult } from "./shared";

export type InternalToolId = AgentInternalToolId;

/** Identity helper that preserves TypeBox param inference for `execute`. */
function defineTool<P extends TSchema>(def: {
  name: string;
  label: string;
  description: string;
  parameters: P;
  execute: (
    id: string,
    params: Static<P>,
    signal?: AbortSignal
  ) => Promise<AgentToolResult<unknown>>;
  executionMode?: AgentTool["executionMode"];
}): AgentTool {
  return def as unknown as AgentTool;
}

function goalParam(): TSchema {
  return Type.Optional(
    Type.String({
      description:
        "Concise user-visible goal for this tool call. Explain why this step is needed, not just what the tool is.",
    })
  );
}

export const INTERNAL_TOOL_IDS: InternalToolId[] = [
  "checkpoint",
  "bash",
  "read",
  "write",
  "edit",
  "ls",
  "grep",
];

export interface InternalToolDeps {
  sandboxMode: SandboxMode;
  /** Absolute execution root. Empty means the backend uses its managed sandbox dir. */
  workspaceRoot: string;
  requestCheckpoint?: RequestCheckpoint;
}

export interface CheckpointRequest {
  toolCallId: string;
  title: string;
  summary: string;
  proposedAction: string;
  risk?: string;
  artifacts?: string[];
}

export interface CheckpointDecision {
  approved: boolean;
  note?: string;
  decidedAt: string;
}

export type RequestCheckpoint = (
  request: CheckpointRequest,
  signal?: AbortSignal
) => Promise<CheckpointDecision>;

interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  sandboxBackend: string;
}

function checkpointTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "checkpoint",
    label: "Checkpoint",
    description:
      "Pause the agent and request explicit human approval before a protected action. " +
      "Use before destructive or irreversible steps.",
    parameters: Type.Object({
      goal: goalParam(),
      title: Type.String({
        description: "Short approval title shown to the human.",
      }),
      summary: Type.String({
        description: "What has been prepared and why approval is needed.",
      }),
      proposedAction: Type.String({
        description: "The exact action the agent wants to perform next.",
      }),
      risk: Type.Optional(
        Type.String({
          description: "Main risk or consequence if the action proceeds.",
        })
      ),
      artifacts: Type.Optional(
        Type.Array(
          Type.String({
            description: "Relevant files, commands, channels, or outputs.",
          })
        )
      ),
    }),
    executionMode: "sequential",
    execute: async (toolCallId, params, signal) => {
      if (!deps.requestCheckpoint) {
        throw new Error("Checkpoint approval UI is not available");
      }
      const decision = await deps.requestCheckpoint(
        {
          toolCallId,
          title: params.title,
          summary: params.summary,
          proposedAction: params.proposedAction,
          risk: params.risk,
          artifacts: params.artifacts,
        },
        signal
      );
      return textResult(
        decision.approved
          ? `Checkpoint approved${decision.note ? `: ${decision.note}` : ""}`
          : `Checkpoint rejected${decision.note ? `: ${decision.note}` : ""}`,
        decision
      );
    },
  });
}

function bashTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "bash",
    label: "Bash",
    description:
      "Run a shell command via bash inside the sandbox. Use for builds, git, " +
      "and any task not covered by the dedicated file tools.",
    parameters: Type.Object({
      goal: goalParam(),
      command: Type.String({ description: "The shell command to execute." }),
      timeoutMs: Type.Optional(
        Type.Number({ description: "Timeout in ms (1000-120000)." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<SandboxRunResponse>("run_sandboxed_command", {
        req: {
          command: "bash",
          args: ["-lc", params.command],
          cwd: deps.workspaceRoot.trim() || undefined,
          sandboxMode: deps.sandboxMode,
          timeoutMs: params.timeoutMs,
        },
      });
      const parts: string[] = [];
      if (res.stdout) parts.push(res.stdout);
      if (res.stderr) parts.push(`[stderr]\n${res.stderr}`);
      if (res.timedOut) parts.push("[超时] 命令被终止");
      parts.push(`[exit ${res.exitCode ?? "null"}]`);
      const out = parts.join("\n").trim();
      return textResult(out || "(无输出)", res);
    },
  });
}

interface FsReadResponse {
  path: string;
  content: string;
  truncated: boolean;
  lineCount: number;
}

function readTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "read",
    label: "Read file",
    description:
      "Read a UTF-8 text file. Optionally start at a 1-based line offset.",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.String({
        description: "File path (absolute or relative to the execution root).",
      }),
      offset: Type.Optional(Type.Number({ description: "1-based start line." })),
      limit: Type.Optional(
        Type.Number({ description: "Max lines to return." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FsReadResponse>("fs_read", {
        req: {
          workspaceRoot: deps.workspaceRoot.trim(),
          path: params.path,
          sandboxMode: deps.sandboxMode,
          offset: params.offset,
          limit: params.limit,
        },
      });
      const suffix = res.truncated ? "\n…(内容已截断)" : "";
      return textResult(res.content + suffix, res);
    },
  });
}

interface FsWriteResponse {
  path: string;
  bytesWritten: number;
}

function writeTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "write",
    label: "Write file",
    description:
      "Create or overwrite a text file. Denied in read-only sandbox; in " +
      "workspace-write the path must stay inside the execution root or temp.",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.String({
        description: "File path (absolute or relative to the execution root).",
      }),
      content: Type.String({ description: "Full file content to write." }),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FsWriteResponse>("fs_write", {
        req: {
          workspaceRoot: deps.workspaceRoot.trim(),
          path: params.path,
          content: params.content,
          sandboxMode: deps.sandboxMode,
        },
      });
      return textResult(`已写入 ${res.path} (${res.bytesWritten} 字节)`, res);
    },
  });
}

interface FsEditResponse {
  path: string;
  replaced: number;
}

function editTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "edit",
    label: "Edit file",
    description:
      "Replace an exact string in a file. Fails if oldStr is missing or matches " +
      "more than once (unless replaceAll is set).",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.String({
        description: "File path (absolute or relative to the execution root).",
      }),
      oldStr: Type.String({ description: "Exact text to replace." }),
      newStr: Type.String({ description: "Replacement text." }),
      replaceAll: Type.Optional(
        Type.Boolean({ description: "Replace every occurrence." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FsEditResponse>("fs_edit", {
        req: {
          workspaceRoot: deps.workspaceRoot.trim(),
          path: params.path,
          oldStr: params.oldStr,
          newStr: params.newStr,
          replaceAll: params.replaceAll,
          sandboxMode: deps.sandboxMode,
        },
      });
      return textResult(`已更新 ${res.path}（替换 ${res.replaced} 处）`, res);
    },
  });
}

interface FsListEntry {
  name: string;
  kind: string;
  size: number;
}
interface FsListResponse {
  path: string;
  entries: FsListEntry[];
}

function lsTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "ls",
    label: "List directory",
    description: "List the entries of a directory.",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.Optional(
        Type.String({
          description:
            "Directory path. Defaults to the current execution root.",
        })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FsListResponse>("fs_list", {
        req: {
          workspaceRoot: deps.workspaceRoot.trim(),
          path: params.path,
          sandboxMode: deps.sandboxMode,
        },
      });
      const lines = res.entries.map((e) =>
        e.kind === "dir" ? `${e.name}/` : `${e.name} (${e.size}B)`
      );
      return textResult(`${res.path}\n${lines.join("\n") || "(空目录)"}`, res);
    },
  });
}

interface FsGrepMatch {
  path: string;
  line: number;
  text: string;
}
interface FsGrepResponse {
  matches: FsGrepMatch[];
  truncated: boolean;
}

function grepTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "grep",
    label: "Grep",
    description:
      "Search file contents with a regular expression, recursively under a path.",
    parameters: Type.Object({
      goal: goalParam(),
      pattern: Type.String({
        description: "Regular expression to search for.",
      }),
      path: Type.Optional(
        Type.String({
          description:
            "Root path to search. Defaults to the current execution root.",
        })
      ),
      ignoreCase: Type.Optional(
        Type.Boolean({ description: "Case-insensitive." })
      ),
      maxResults: Type.Optional(
        Type.Number({ description: "Cap on matches." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FsGrepResponse>("fs_grep", {
        req: {
          workspaceRoot: deps.workspaceRoot.trim(),
          pattern: params.pattern,
          path: params.path,
          ignoreCase: params.ignoreCase,
          maxResults: params.maxResults,
          sandboxMode: deps.sandboxMode,
        },
      });
      const lines = res.matches.map((m) => `${m.path}:${m.line}: ${m.text}`);
      const suffix = res.truncated ? "\n…(结果已截断)" : "";
      return textResult((lines.join("\n") || "(无匹配)") + suffix, res);
    },
  });
}

const BUILDERS: Record<InternalToolId, (deps: InternalToolDeps) => AgentTool> = {
  checkpoint: checkpointTool,
  bash: bashTool,
  read: readTool,
  write: writeTool,
  edit: editTool,
  ls: lsTool,
  grep: grepTool,
};

/** Build the selected internal tools. */
export function buildInternalTools(
  enabled: InternalToolId[],
  deps: InternalToolDeps
): AgentTool[] {
  return enabled.filter((id) => id in BUILDERS).map((id) => BUILDERS[id](deps));
}
