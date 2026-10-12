import { invoke } from "@tauri-apps/api/core";
import {
  WECHAT_FORMAT_SCRIPT_REL,
  WECHAT_PUBLISH_SCRIPT_REL,
} from "@/lib/content/content-artifacts";
import { draftFolderFromFilePath } from "@/lib/artifact/draft-workspace";

export interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs?: number;
}

export type WechatPipelineResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

export function describeWechatPipelineError(result: {
  ok?: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  message?: string;
}): string {
  const raw = [result.message, result.stderr, result.stdout]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n")
    .trim();
  if (/python was not found/i.test(raw) || /microsoft store/i.test(raw) || /app execution aliases/i.test(raw)) {
    return "找不到可用的 Python。Windows 的 python3 经常是微软商店占位程序。请安装 Python 3，并在「设置 → 应用 → 高级应用设置 → 应用执行别名」里关闭 python.exe 和 python3.exe。";
  }
  if (result.timedOut) return "排版超时。请稍后重试。";
  return raw.slice(0, 400) || `排版失败（exit ${result.exitCode ?? "?"}）`;
}

function joinRoot(root: string, rel: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[/\\]+$/, "")}${sep}${rel.replace(/^[/\\]+/, "").replace(/\//g, sep)}`;
}

export function draftDirFromArticlePath(articleFilePath: string): string | null {
  return draftFolderFromFilePath(articleFilePath);
}

async function runPythonAtRoot(
  root: string,
  args: string[],
  timeoutMs = 180_000,
): Promise<WechatPipelineResult> {
  const res = await invoke<SandboxRunResponse>("run_sandboxed_command", {
    req: {
      command: "python3",
      args,
      cwd: root,
      sandboxMode: "workspace-write",
      timeoutMs,
    },
  });
  const ok = !res.timedOut && res.exitCode === 0;
  return {
    ok,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    exitCode: res.exitCode,
    timedOut: res.timedOut,
  };
}

/** Generate WeChat HTML from the on-disk article.md in a draft folder. */
export async function runWechatFormatForDraft(input: {
  draftDirAbs: string;
  workspaceRoot: string;
}): Promise<WechatPipelineResult> {
  const articleMd = joinRoot(input.draftDirAbs, "article.md");
  const script = joinRoot(input.workspaceRoot, WECHAT_FORMAT_SCRIPT_REL);
  return runPythonAtRoot(input.workspaceRoot, [script, articleMd]);
}

/** Format from latest article.md then push to WeChat draft box (publish.py full). */
export async function runWechatPublishFullForDraft(input: {
  draftDirAbs: string;
  workspaceRoot: string;
  accountSlot: number;
}): Promise<WechatPipelineResult> {
  const script = joinRoot(input.workspaceRoot, WECHAT_PUBLISH_SCRIPT_REL);
  const draftDir = input.draftDirAbs.replace(/[/\\]+$/, "");
  return runPythonAtRoot(input.workspaceRoot, [
    script,
    "--account",
    String(input.accountSlot),
    "full",
    `${draftDir}/`,
  ]);
}

export async function resolveWorkspaceRoot(): Promise<string> {
  return (await invoke<string>("get_niuma_root_dir").catch(() => "")) || "";
}
