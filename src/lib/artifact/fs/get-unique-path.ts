import { listDirectory } from "./list";
import type { SimpleDirEntry } from "./fs.type";

export async function getUniquePath(path: string): Promise<string> {
  const normalized = path.replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  const dir = normalized.slice(0, slashIndex);
  const filename = normalized.slice(slashIndex + 1);
  const dotIndex = filename.lastIndexOf(".");
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : "";

  const entries = await listDirectory(dir).catch(() => [] as SimpleDirEntry[]);
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()));

  if (!names.has(filename.toLowerCase())) return path;

  let counter = 1;
  while (true) {
    const candidateName = `${basename} (${counter})${ext}`;
    if (!names.has(candidateName.toLowerCase())) {
      return `${dir}/${candidateName}`;
    }
    counter += 1;
  }
}
