import { invoke } from "@tauri-apps/api/core";
import { normalizeFsPath } from "../workspace-path";
import type { SimpleDirEntry } from "./fs.type";

export async function listDirectory(path: string): Promise<SimpleDirEntry[]> {
  const result = await invoke<SimpleDirEntry[]>("list_directory", { path: normalizeFsPath(path) });
  return result.map((entry) => ({ ...entry, path: normalizeFsPath(entry.path) }));
}
