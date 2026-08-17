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
import { invoke, textResult, normalizeTauriPath } from "./shared";
import { getImaKbConfig } from "@/lib/storage/ima.storage";

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
  "file_search",
  "web_search",
  "ima_search",
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
      "Run a shell command in the sandbox. " +
      "On macOS/Linux this uses bash; on Windows it routes through PowerShell when bash (WSL/Git Bash) is unavailable. " +
      "Supported runtimes: python/python3 (Python), node (Node.js), pwsh/powershell (PowerShell). " +
      "On Windows prefer PowerShell syntax (semicolons instead of &&, $env:VAR for env vars). " +
      "Use for builds, git, running scripts, and any task not covered by the dedicated file tools.",
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

interface FileSearchEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}
interface FileSearchResponse {
  entries: FileSearchEntry[];
  truncated: boolean;
  scannedRoots: string[];
}

function fileSearchTool(): AgentTool {
  return defineTool({
    name: "file_search",
    label: "Search local files",
    description:
      "Search the user's entire local disk for files/folders whose NAME contains " +
      "the given text (case-insensitive substring match, not full-text content search). " +
      "Best-effort and time-boxed: results may be truncated on large disks.",
    parameters: Type.Object({
      goal: goalParam(),
      query: Type.String({
        description: "Substring to match against file/folder names.",
      }),
      maxResults: Type.Optional(
        Type.Number({ description: "Cap on results (default 50, max 200)." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<FileSearchResponse>("search_local_files", {
        req: { query: params.query, maxResults: params.maxResults },
      });
      const lines = res.entries.map(
        (e) => `${e.isDir ? "[dir] " : ""}${e.path}${e.isDir ? "" : ` (${e.size}B)`}`
      );
      const suffix = res.truncated ? "\n…(结果已截断，磁盘较大或用时超限)" : "";
      return textResult((lines.join("\n") || "(未找到匹配文件)") + suffix, res);
    },
  });
}

interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}
interface WebSearchResponse {
  results: WebSearchResultItem[];
}

function webSearchTool(): AgentTool {
  return defineTool({
    name: "web_search",
    label: "Web search",
    description:
      "Search the public web (via DuckDuckGo) and return matching page titles, " +
      "URLs, and snippets. Use this for current events or facts not in your training data.",
    parameters: Type.Object({
      goal: goalParam(),
      query: Type.String({ description: "The search query." }),
      maxResults: Type.Optional(
        Type.Number({ description: "Cap on results (default 8, max 20)." })
      ),
    }),
    execute: async (_id, params) => {
      const res = await invoke<WebSearchResponse>("web_search", {
        req: { query: params.query, maxResults: params.maxResults },
      });
      const lines = res.results.map(
        (r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      );
      return textResult(lines.join("\n\n") || "(无搜索结果)", res);
    },
  });
}

interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function imaSearchTool(): AgentTool {
  return defineTool({
    name: "ima_search",
    label: "Search IMA 文章资产",
    description:
      "Search the user's IMA 文章资产 knowledge base (containing 蜜粉 and 飞鸟 folders). " +
      "Returns article titles, a content excerpt (for WeChat articles), and source citations. " +
      "Use this when the user asks about topics likely covered in their collected or written articles.",
    parameters: Type.Object({
      goal: goalParam(),
      query: Type.String({ description: "The search query in Chinese or English." }),
    }),
    execute: async (_id, params) => {
      const cfg = getImaKbConfig();
      if (!cfg.kbId) {
        return textResult("IMA 知识库未配置（kbId 为空）。请先在文章编辑器右侧面板完成配置。");
      }

      // 1. Get skills dir and build ima-skill path
      let skillsDir: string;
      try {
        skillsDir = normalizeTauriPath(await invoke<string>("get_niuma_skills_dir"));
      } catch (e) {
        return textResult(`无法获取技能目录: ${String(e)}`);
      }
      const sep = skillsDir.includes("/") ? "/" : "\\";
      const imaSkillDir = `${skillsDir}${sep}ima-skill`;

      // Helper: call ima_api.cjs via sandboxed node.
      // Tauri's sandbox clears env vars (env_clear), so we read credentials
      // from .env.local at the project root and pass as explicit options
      // (ima_api.cjs priority 1) instead of relying on env var inheritance.
      const imaOptions = await (async () => {
        try {
          const rootDir = normalizeTauriPath(
            await invoke<string>("get_niuma_root_dir")
          );
          if (!rootDir) return "{}";
          const s = rootDir.includes("/") ? "/" : "\\";
          const raw = await invoke<string>("read_text_file", {
            path: `${rootDir}${s}.env.local`,
          }).catch(() => "");
          if (!raw) return "{}";
          const env: Record<string, string> = {};
          for (const line of raw.split(/\r?\n/)) {
            const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (!m) continue;
            env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
          }
          const clientId = env.IMA_CLIENT_ID ?? env.IMA_OPENAPI_CLIENTID ?? "";
          const apiKey = env.IMA_API_KEY ?? env.IMA_OPENAPI_APIKEY ?? "";
          if (clientId && apiKey) return JSON.stringify({ clientId, apiKey });
        } catch { /* ignore */ }
        return "{}"; // fall back to ima_api.cjs internal .env.local traversal
      })();

      const imaCall = async (apiPath: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const result = await invoke<SandboxRunResponse>("run_sandboxed_command", {
          req: {
            command: "node",
            args: ["ima_api.cjs", apiPath, JSON.stringify(body), imaOptions],
            cwd: imaSkillDir,
            sandboxMode: "read-only",
            timeoutMs: 20000,
          },
        });
        if (result.timedOut) throw new Error("IMA 请求超时");
        if (result.exitCode !== 0) {
          const msg = (() => { try { return (JSON.parse(result.stderr) as { msg?: string }).msg ?? ""; } catch { return ""; } })();
          throw new Error(msg || result.stderr.trim() || "IMA 请求失败");
        }
        const parsed = JSON.parse(result.stdout || "{}") as Record<string, unknown>;
        if (typeof parsed.code === "number" && parsed.code !== 0) throw new Error(String(parsed.msg || "IMA 返回错误"));
        return (parsed.data ?? parsed) as Record<string, unknown>;
      };

      // 2. Search knowledge base
      let searchItems: Array<Record<string, unknown>>;
      try {
        const searchData = await imaCall("openapi/wiki/v1/search_knowledge", {
          query: params.query,
          cursor: "",
          knowledge_base_id: cfg.kbId,
        });
        searchItems = (searchData.info_list ?? []) as Array<Record<string, unknown>>;
      } catch (e) {
        return textResult(`IMA 搜索失败: ${String(e)}`);
      }

      if (searchItems.length === 0) {
        return textResult(`在 IMA 文章资产中未找到与「${params.query}」相关的内容。`);
      }

      // 3. Enrich top 3 results with URL + content
      const lines: string[] = [`[IMA 文章资产搜索结果 · 「${params.query}」]\n`];

      for (const item of searchItems.slice(0, 3)) {
        const title = String(item.title ?? "未命名");
        const mediaId = String(item.media_id ?? "");
        const mediaType = Number(item.media_type ?? 0);
        lines.push(`《${title}》`);

        if (mediaId) {
          try {
            const info = await imaCall("openapi/wiki/v1/get_media_info", { media_id: mediaId });
            const url = String((info.url_info as { url?: string } | undefined)?.url ?? "");

            if (url && mediaType === 6) {
              // WeChat article — fetch content
              try {
                const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
                const resp = await tauriFetch(url, {
                  method: "GET",
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                  },
                });
                if (resp.ok) {
                  const html = await resp.text();
                  const text = html
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
                    .replace(/\s+/g, " ").trim().slice(0, 1500);
                  if (text) lines.push(`内容摘要: ${text}`);
                }
              } catch {
                lines.push(`来源: ${url}`);
              }
            } else if (url) {
              lines.push(mediaType === 1 ? `（PDF 文件，请在 IMA 中打开）来源: ${url}` : `来源: ${url}`);
            }
          } catch {
            // skip enrichment on error
          }
        }
        lines.push(`[标注: IMA 文章资产 · 《${title}》]\n`);
      }

      return textResult(lines.join("\n"));
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
  file_search: fileSearchTool,
  web_search: webSearchTool,
  ima_search: imaSearchTool,
};

/** Build the selected internal tools. */
export function buildInternalTools(
  enabled: InternalToolId[],
  deps: InternalToolDeps
): AgentTool[] {
  return enabled.filter((id) => id in BUILDERS).map((id) => BUILDERS[id](deps));
}
