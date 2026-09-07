import { writeText } from "./write";
import { normalizeFsPath } from "../workspace-path";

export async function ensureDir(path: string): Promise<void> {
  // Reuse existing write command behavior: it creates parent directories.
  const markerPath = `${normalizeFsPath(path).replace(/\/$/, "")}/.niuma.keep`;
  await writeText(markerPath, "");
}
