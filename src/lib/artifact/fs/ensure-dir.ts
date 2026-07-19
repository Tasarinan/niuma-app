import { writeText } from "./write";

export async function ensureDir(path: string): Promise<void> {
  // Reuse existing write command behavior: it creates parent directories.
  const markerPath = `${path.replace(/[\\/]$/, "")}/.niuma.keep`;
  await writeText(markerPath, "");
}
