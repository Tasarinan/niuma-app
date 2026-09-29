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
import { getImaKbConfig } from "@/lib/storage/ima.storage";
import { runImaOpenApi } from "@/lib/ima/openapi";
import { notifyDraftFileChanged, requestOpenWorkbenchArticle } from "@/lib/artifact/open-workbench-article";
import { isOpenableDraftMarkdown, toDraftArticlePath } from "@/lib/artifact/drafts";
import {
  writeBinary,
  readBinaryBase64,
  writeText,
  readText,
  listDirectory,
  removeFile,
} from "@/lib/artifact/fs";
import { consolidateDraftImages } from "@/lib/artifact/consolidate-draft-images";
import {
  convertDraftImageToPngImgs,
  ensurePngBytes,
  isRasterImagePath,
  pngBytesToDataUrl,
  toDraftImgsAbsPath,
  toPngPath,
} from "@/lib/artifact/png-images";
import {
  isPathInsideWorkspace,
  resolveWorkspacePath,
} from "@/lib/artifact/workspace-path";
import { isBindableDraftMarkdown, locateDraftMarkdownPath } from "@/lib/artifact/current-draft";
import { generateProviderImage } from "@/lib/providers/media";
import {
  draftImageStem,
  formatDraftImagePromptMarkdown,
  promptMarkdownAbsPath,
} from "@/lib/artifact/draft-workspace";
import {
  downloadWebImageBytes,
  formatWebImageHits,
  searchWebImages,
} from "@/lib/artifact/web-image";

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
  "open_article",
  "generate_image",
  "search_images",
  "save_web_image",
  "consolidate_draft_images",
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
      "Read a UTF-8 text file. For raster images (png/jpg/jfif/webp/gif), convert to PNG under the draft imgs/ folder and return that path — WeChat only accepts PNG.",
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
      if (isRasterImagePath(params.path) && deps.workspaceRoot.trim()) {
        const abs = resolveWorkspacePath(deps.workspaceRoot, params.path);
        const converted = await convertDraftImageToPngImgs({
          absPath: abs,
          readBase64: readBinaryBase64,
          writeBytes: writeBinary,
          write: deps.sandboxMode !== "read-only",
        });
        if (converted) {
          const note = converted.converted
            ? `已将图片转为 PNG 并保存到 ${converted.dest}`
            : `图片已是 PNG：${converted.dest}`;
          return textResult(
            `${note}\n正文引用请用 ${converted.relativeSrc}\n微信公众号只接受 PNG。不要用 read 读取像素内容。`,
            { path: converted.dest, relativeSrc: converted.relativeSrc, converted: converted.converted },
          );
        }
      }
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

function afterDraftWrite(path: string): void {
  if (isOpenableDraftMarkdown(path)) {
    notifyDraftFileChanged(path);
  }
  if (isBindableDraftMarkdown(path)) {
    requestOpenWorkbenchArticle({ filePath: toDraftArticlePath(path) });
  }
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
      afterDraftWrite(res.path);
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
      afterDraftWrite(res.path);
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

      const imaCall = (apiPath: string, body: Record<string, unknown>) => runImaOpenApi(apiPath, body);

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

function resolveAuthorizedMediaPath(deps: InternalToolDeps, path: string): string {
  const abs = resolveWorkspacePath(deps.workspaceRoot, path);
  if (deps.sandboxMode === "danger-full-access") return abs;
  const root = deps.workspaceRoot.trim();
  if (!root) {
    throw new Error("没有工作区根路径，无法保存生成的图片");
  }
  if (!isPathInsideWorkspace(root, abs)) {
    throw new Error(`路径必须在工作区内: ${path}`);
  }
  return abs;
}

function generateImageTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "generate_image",
    label: "Generate image",
    description:
      "Generate a PNG with the in-app API provider (Settings → API 提供商 image model) " +
      "and write it under the draft imgs/ folder. " +
      "Do not use IMAGE_MODEL_API_KEY, image_create.py, Pollinations, or bash for this.",
    parameters: Type.Object({
      goal: goalParam(),
      prompt: Type.String({
        description: "Image generation prompt (Chinese or English).",
      }),
      path: Type.String({
        description:
          "Output PNG path under imgs/. Use cover.png only for the article cover; screenshots and inline images use 01.png, 02.png, or {theme}-01.png (never cover for screenshots).",
      }),
      image: Type.Optional(
        Type.String({
          description: "Optional reference image path for img2img.",
        }),
      ),
    }),
    execute: async (_id, params) => {
      if (deps.sandboxMode === "read-only") {
        throw new Error("当前沙箱为只读，不能生图写文件");
      }
      const outPath = toDraftImgsAbsPath(toPngPath(resolveAuthorizedMediaPath(deps, params.path)));
      let referenceDataUrl: string | undefined;
      if (params.image?.trim()) {
        const refPath = resolveAuthorizedMediaPath(deps, params.image);
        const converted = await convertDraftImageToPngImgs({
          absPath: refPath,
          readBase64: readBinaryBase64,
          writeBytes: writeBinary,
          write: true,
        });
        if (converted) {
          referenceDataUrl = pngBytesToDataUrl(converted.png);
        } else {
          const b64 = await readBinaryBase64(refPath);
          const png = await ensurePngBytes(
            Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)),
          );
          referenceDataUrl = pngBytesToDataUrl(png);
        }
      }
      const bytes = await generateProviderImage({
        prompt: params.prompt,
        referenceDataUrl,
      });
      const png = await ensurePngBytes(bytes);
      await writeBinary(outPath, png);
      const imageName = outPath.replace(/^.*[\\/]/, "");
      await writeText(
        promptMarkdownAbsPath(outPath),
        formatDraftImagePromptMarkdown({
          title: draftImageStem(imageName),
          filename: imageName,
          prompt: String(params.prompt ?? ""),
        }),
      );
      return textResult(`已生成 PNG ${outPath} (${png.byteLength} 字节)`, {
        path: outPath,
        bytes: png.byteLength,
      });
    },
  });
}

function searchImagesTool(): AgentTool {
  return defineTool({
    name: "search_images",
    label: "Search similar images",
    description:
      "Search Unsplash first for similar photos, then Wikimedia Commons and DuckDuckGo. " +
      "Returns image URLs and source pages. Then call save_web_image to store a PNG under imgs/. " +
      "Use this instead of generate_image when a real photo, product shot, UI screenshot, or existing picture fits better.",
    parameters: Type.Object({
      goal: goalParam(),
      query: Type.String({ description: "What the picture should look like (Chinese or English)." }),
      maxResults: Type.Optional(
        Type.Number({ description: "Cap on results (default 8, max 12)." }),
      ),
    }),
    execute: async (_id, params) => {
      const hits = await searchWebImages(String(params.query ?? ""), Number(params.maxResults ?? 8));
      return textResult(formatWebImageHits(hits), { results: hits });
    },
  });
}

function saveWebImageTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "save_web_image",
    label: "Save web image",
    description:
      "Download a public image URL, convert it to PNG, and write it under the draft imgs/ folder. " +
      "Call after search_images. Records the source URL in imgs/prompts/<name>.md.",
    parameters: Type.Object({
      goal: goalParam(),
      url: Type.String({ description: "Direct image URL from search_images (the image: line)." }),
      path: Type.String({
        description:
          "Output PNG path under imgs/. Use cover.png only for the article cover; screenshots and inline images use 01.png, 02.png, or {theme}-01.png (never cover for screenshots).",
      }),
      prompt: Type.Optional(
        Type.String({ description: "Why this picture was chosen / search query." }),
      ),
      sourceUrl: Type.Optional(
        Type.String({ description: "Source page URL from search_images (the page: line)." }),
      ),
    }),
    execute: async (_id, params) => {
      if (deps.sandboxMode === "read-only") {
        throw new Error("当前沙箱为只读，不能保存网上的图");
      }
      const outPath = toDraftImgsAbsPath(toPngPath(resolveAuthorizedMediaPath(deps, params.path)));
      const bytes = await downloadWebImageBytes(String(params.url ?? ""));
      const png = await ensurePngBytes(bytes);
      await writeBinary(outPath, png);
      const imageName = outPath.replace(/^.*[\\/]/, "");
      await writeText(
        promptMarkdownAbsPath(outPath),
        formatDraftImagePromptMarkdown({
          title: draftImageStem(imageName),
          filename: imageName,
          prompt: String(params.prompt ?? params.url ?? ""),
          sourceUrl: String(params.sourceUrl ?? params.url ?? ""),
        }),
      );
      return textResult(`已保存网上的 PNG ${outPath} (${png.byteLength} 字节)`, {
        path: outPath,
        bytes: png.byteLength,
        source: String(params.sourceUrl ?? params.url ?? ""),
      });
    },
  });
}

function consolidateDraftImagesTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "consolidate_draft_images",
    label: "整理草稿配图",
    description:
      "Move raster images in the current draft folder into imgs/*.png with themed WeChat-safe names, " +
      "convert to PNG, and rewrite article.md / topic.md / review.md image refs so alt matches the filename.",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.String({
        description: "Path to article.md or the draft folder under .artifacts/drafts/.",
      }),
    }),
    execute: async (_id, params) => {
      const raw = String(params.path ?? "").trim();
      const resolved = raw.toLowerCase().endsWith(".md")
        ? locateDraftMarkdownPath(deps.workspaceRoot, raw)
        : locateDraftMarkdownPath(
            deps.workspaceRoot,
            `${raw.replace(/\/$/, "")}/article.md`,
          );
      const articlePath = toDraftArticlePath(resolved);
      const result = await consolidateDraftImages({
        articlePath,
        readText,
        writeText,
        readBase64: readBinaryBase64,
        writeBytes: writeBinary,
        listDirectory,
        removeFile,
      });
      notifyDraftFileChanged(articlePath);
      const lines = [
        `已整理草稿配图：${result.folder}`,
        `主题前缀：${result.themeSlug}`,
        `写入 ${result.written.length} 个 PNG`,
        result.removed.length ? `已移走/删除 ${result.removed.length} 个旧文件（含草稿根目录截图）` : "",
        result.updatedMarkdown.length
          ? `已更新：${result.updatedMarkdown.map((p) => p.replace(/\\/g, "/")).join(", ")}`
          : "Markdown 引用已对齐，无需改写",
      ];
      return textResult(lines.join("\n"), result);
    },
  });
}

function openArticleTool(deps: InternalToolDeps): AgentTool {
  return defineTool({
    name: "open_article",
    label: "定位当前文稿",
    description:
      "Locate a confirmed draft Markdown file as the current manuscript. " +
      "Does not switch the workbench to 编辑 — the human clicks 编辑 to see it. " +
      "Use after the 主理人 has created topic.md. Do not call during roundtable discussion " +
      "before the topic folder exists.",
    parameters: Type.Object({
      goal: goalParam(),
      path: Type.String({
        description: "Absolute or workspace-relative path to article.md, topic.md, or review.md.",
      }),
      focus: Type.Optional(
        Type.String({
          description: "editor (default), images, or review — only used if the human is already in 编辑",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const filePath = locateDraftMarkdownPath(deps.workspaceRoot, params.path);
      const focusRaw = String(params.focus ?? "editor").trim().toLowerCase();
      const focus =
        focusRaw === "images" || focusRaw === "review" ? focusRaw : "editor";
      requestOpenWorkbenchArticle({ filePath: toDraftArticlePath(filePath), focus });
      return textResult(
        `已定位当前共创目录：${filePath}。请用户点「编辑」查看，不要自动打开编辑栏。`,
      );
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
  open_article: openArticleTool,
  generate_image: generateImageTool,
  search_images: searchImagesTool,
  save_web_image: saveWebImageTool,
  consolidate_draft_images: consolidateDraftImagesTool,
};

/** Build the selected internal tools. */
export function buildInternalTools(
  enabled: InternalToolId[],
  deps: InternalToolDeps
): AgentTool[] {
  return enabled.filter((id) => id in BUILDERS).map((id) => BUILDERS[id](deps));
}
