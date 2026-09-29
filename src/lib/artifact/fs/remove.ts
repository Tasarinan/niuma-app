import { invoke } from "@tauri-apps/api/core";
import { normalizeFsPath } from "../workspace-path";

/** Delete a single file (not a directory). Missing paths are ignored. */
export async function removeFile(path: string): Promise<void> {
  await invoke("remove_file", { path: normalizeFsPath(path) });
}
