import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";

let configDirPromise: Promise<string> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Absolute path to `<workspace>/.niumaconfig` (sibling of `.teams`). */
export async function getNiumaConfigDir(): Promise<string> {
  if (!isTauri()) {
    throw new Error("Niuma config dir is only available in the desktop app");
  }
  if (!configDirPromise) {
    configDirPromise = invoke<string>("get_niuma_config_dir");
  }
  return configDirPromise;
}

export async function niumaConfigStorePath(fileName: string): Promise<string> {
  const dir = await getNiumaConfigDir();
  return join(dir, fileName);
}
