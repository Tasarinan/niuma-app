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
