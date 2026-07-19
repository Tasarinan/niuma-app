import { invoke } from "@tauri-apps/api/core";
import type { SimpleDirEntry } from "./fs.type";

export async function listDirectory(path: string): Promise<SimpleDirEntry[]> {
  const result = await invoke<SimpleDirEntry[]>("list_directory", { path });
  return result;
}
