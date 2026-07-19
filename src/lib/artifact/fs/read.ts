import type { SimpleDirEntry } from "./fs.type";
import { listDirectory } from "./list";
import { invoke } from "@tauri-apps/api/core";

export async function readText(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function readDirRecursive(path: string): Promise<SimpleDirEntry[]> {
  const entries = await listDirectory(path).catch(() => [] as SimpleDirEntry[]);
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDir && !entry.name.startsWith("."))
      .map((entry) => readDirRecursive(entry.path).catch(() => [] as SimpleDirEntry[])),
  );
  return [...entries, ...nested.flat()];
}
