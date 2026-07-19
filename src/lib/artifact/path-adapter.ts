import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path";

const ROOT_DIR = "niuma";
const ARTIFACT_DIR = "artifact";

export async function getArtifactRootDir(): Promise<string> {
  const docDir = await documentDir();
  return join(docDir, ROOT_DIR);
}

export async function getArtifactDir(): Promise<string> {
  const root = await getArtifactRootDir();
  return join(root, ARTIFACT_DIR);
}

export async function getArtifactDirs(): Promise<string[]> {
  try {
    const resolved = await invoke<string[]>("get_artifact_dirs");
    if (resolved.length > 0) {
      const unique: string[] = [];
      for (const value of resolved) {
        const normalized = value.replace(/\\/g, "/").replace(/^\\\?\//, "").replace(/\/$/, "");
        if (!unique.some((item) => item.replace(/\\/g, "/").replace(/^\\\?\//, "").replace(/\/$/, "").toLowerCase() === normalized.toLowerCase())) {
          unique.push(value);
        }
      }
      return unique;
    }
  } catch {
    // Fall through to documentDir fallback.
  }

  return [await getArtifactDir()];
}

export function getEntryName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function getParentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/");
}

export function toRelativePath(rootPath: string, fullPath: string): string {
  const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  const full = fullPath.replace(/\\/g, "/");
  if (!full.startsWith(root)) return full;
  return full.slice(root.length).replace(/^\//, "");
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}
