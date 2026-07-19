import { invoke } from "@tauri-apps/api/core";

export async function writeText(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}
