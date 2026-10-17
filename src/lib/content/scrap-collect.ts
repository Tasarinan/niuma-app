import { invoke } from "@tauri-apps/api/core";

function joinRoot(root: string, rel: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[/\\]+$/, "")}${sep}${rel.replace(/^[/\\]+/, "").replace(/\//g, sep)}`;
}

export const SCRAP_COLLECT_SCRIPT_REL =
  ".teams/content/skills/scraps/scripts/collect.py";

export interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs?: number;
}

export interface ScrapCollectItem {
  source?: string;
  title?: string;
  url?: string;
  heat?: string;
  time?: string;
  hn_url?: string;
  content?: string;
  engine?: string;
  relevance?: number;
}

export interface ScrapCollectPayload {
  sources?: string[];
  profile?: string;
  keywords?: string[];
  deep?: boolean;
  playwright?: boolean;
  collectedAt?: string;
  failed?: string[];
  items?: ScrapCollectItem[];
}

export type ScrapCollectResult =
  | { ok: true; payload: ScrapCollectPayload; stderr: string; durationMs?: number }
  | {
      ok: false;
      message: string;
      stderr: string;
      stdout: string;
      timedOut: boolean;
      exitCode: number | null;
    };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function runPython(
  workspaceRoot: string,
  scriptAbs: string,
  collectArgs: string[],
  timeoutMs: number,
): Promise<SandboxRunResponse> {
  const runners = ["python3", "python"];
  let last: SandboxRunResponse | null = null;
  for (const command of runners) {
    const res = await invoke<SandboxRunResponse>("run_sandboxed_command", {
      req: {
        command,
        args: [scriptAbs, ...collectArgs],
        cwd: workspaceRoot,
        sandboxMode: "workspace-write",
        timeoutMs,
      },
    });
    last = res;
    const combined = `${res.stderr}\n${res.stdout}`;
    if (
      !res.timedOut &&
      res.exitCode === 0 &&
      !/python was not found/i.test(combined) &&
      !/microsoft store/i.test(combined)
    ) {
      return res;
    }
    if (/python was not found/i.test(combined) || /microsoft store/i.test(combined)) {
      continue;
    }
    return res;
  }
  return (
    last ?? {
      stdout: "",
      stderr: "无法启动 Python",
      exitCode: null,
      timedOut: false,
    }
  );
}

export function parseScrapCollectStdout(stdout: string): ScrapCollectPayload | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as ScrapCollectPayload;
  } catch {
    return null;
  }
}

export function buildScrapCollectCliArgs(input: {
  sources: string[];
  urls: string[];
  keywords: string[];
  /** HTTP deep-read only; skip Playwright (much faster). */
  noPlaywright?: boolean;
  count?: number;
}): string[] {
  const sourceParts = [...input.sources, ...input.urls].filter(Boolean);
  const args: string[] = [];
  if (sourceParts.length) {
    args.push("--sources", sourceParts.join(","));
  }
  if (input.keywords.length) {
    args.push("--keyword", input.keywords.join(","));
  }
  args.push("--deep");
  if (input.noPlaywright !== false) {
    args.push("--no-playwright");
  }
  if (input.count && input.count > 0) {
    args.push("--count", String(input.count));
  }
  return args;
}

export function formatScrapCollectForPrompt(
  payload: ScrapCollectPayload,
  collectJsonRel: string,
): string {
  const items = payload.items ?? [];
  const failed = payload.failed ?? [];
  const lines = [
    `采集脚本已完成，完整 JSON：\`${collectJsonRel}\`（${items.length} 条）。不要再次运行 collect.py。`,
    failed.length ? `失败源：${failed.join("；")}` : "",
    "根据 JSON 的 items 写每条 Markdown（文首原 URL）、briefing.md（约 20 条）、index.json。Deep Dive 只用 content 字段。",
  ].filter(Boolean);
  const preview = items.slice(0, 18).map((item, i) => {
    const title = (item.title || item.url || "untitled").slice(0, 120);
    const contentLen = (item.content || "").length;
    return `${i + 1}. ${title} | ${item.source || "?"} | content=${contentLen} chars | ${item.url || ""}`;
  });
  if (preview.length) {
    lines.push("", "条目预览：", ...preview);
    if (items.length > preview.length) {
      lines.push(`… 另有 ${items.length - preview.length} 条见 collect.json`);
    }
  }
  return lines.join("\n");
}

export async function runScrapCollect(input: {
  workspaceRoot: string;
  sources: string[];
  urls: string[];
  keywords: string[];
  timeoutMs?: number;
}): Promise<ScrapCollectResult> {
  if (!isTauri() || !input.workspaceRoot.trim()) {
    return {
      ok: false,
      message: "采集需要在桌面应用工作区内运行",
      stderr: "",
      stdout: "",
      timedOut: false,
      exitCode: null,
    };
  }
  const root = input.workspaceRoot.replace(/[/\\]+$/, "");
  const scriptAbs = joinRoot(root, SCRAP_COLLECT_SCRIPT_REL);
  const cliArgs = buildScrapCollectCliArgs({
    sources: input.sources,
    urls: input.urls,
    keywords: input.keywords,
    noPlaywright: true,
    count: 24,
  });
  const timeoutMs = input.timeoutMs ?? 240_000;
  const res = await runPython(root, scriptAbs, cliArgs, timeoutMs);
  const payload = parseScrapCollectStdout(res.stdout);
  if (res.timedOut) {
    return {
      ok: false,
      message: `采集超时（${Math.round(timeoutMs / 1000)}s）。可改用 /scrap https://单篇网址 或减少信源。`,
      stderr: res.stderr,
      stdout: res.stdout,
      timedOut: true,
      exitCode: res.exitCode,
    };
  }
  if (!payload) {
    return {
      ok: false,
      message: "采集脚本未返回有效 JSON",
      stderr: res.stderr,
      stdout: res.stdout,
      timedOut: false,
      exitCode: res.exitCode,
    };
  }
  if (res.exitCode !== 0) {
    return {
      ok: false,
      message: `采集脚本退出码 ${res.exitCode ?? "?"}`,
      stderr: res.stderr,
      stdout: res.stdout,
      timedOut: false,
      exitCode: res.exitCode,
    };
  }
  return { ok: true, payload, stderr: res.stderr, durationMs: res.durationMs };
}
