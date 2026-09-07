import { invoke } from "@tauri-apps/api/core";
import { normalizeFsPath } from "../workspace-path";

export async function writeText(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path: normalizeFsPath(path), content });
}

export async function writeBinary(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_binary_file", { path: normalizeFsPath(path), base64: bytesToBase64(bytes) });
}

export async function readBinaryBase64(path: string): Promise<string> {
  return invoke<string>("read_binary_file", { path: normalizeFsPath(path) });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
