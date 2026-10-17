import { invoke } from "@tauri-apps/api/core";
const DEFAULT_SCRAP_DIR = ".artifacts/scraps";

export type ScrapInboxKind = "clip" | "intake";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function joinRoot(root: string, rel: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[/\\]+$/, "")}${sep}${rel.replace(/^[/\\]+/, "").replace(/\//g, sep)}`;
}

export function scrapsInboxDirForDay(dayStamp?: string): string {
  const day = dayStamp ?? new Date().toISOString().slice(0, 10);
  return `${DEFAULT_SCRAP_DIR}/${day}/inbox`;
}

function slugPart(text: string, max = 32): string {
  const cleaned = text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "")
    .slice(0, max);
  return cleaned || "note";
}

export function buildScrapInboxMarkdown(params: {
  kind: ScrapInboxKind;
  body: string;
  clipType?: string;
  entryId?: string;
  title?: string;
}): string {
  const savedAt = new Date().toISOString();
  const lines = [
    "---",
    `kind: ${params.kind}`,
    params.clipType ? `clip_type: ${params.clipType}` : "",
    params.entryId ? `entry_id: ${params.entryId}` : "",
    `saved_at: ${savedAt}`,
    "---",
    "",
    params.title ? `# ${params.title}` : "",
    params.body.trim(),
  ].filter((line) => line !== "");
  return lines.join("\n");
}

export async function writeScrapInboxFile(params: {
  kind: ScrapInboxKind;
  body: string;
  clipType?: string;
  entryId?: string;
  title?: string;
  dayStamp?: string;
}): Promise<string | null> {
  if (!isTauri() || !params.body.trim()) return null;
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root.trim()) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${params.kind}-${params.clipType ?? "material"}-${slugPart(params.body)}-${stamp}.md`;
  const rel = `${scrapsInboxDirForDay(params.dayStamp)}/${name}`;
  const abs = joinRoot(root, rel);
  const content = buildScrapInboxMarkdown(params);
  try {
    await invoke("write_text_file", { path: abs, content });
    return rel;
  } catch {
    return null;
  }
}
