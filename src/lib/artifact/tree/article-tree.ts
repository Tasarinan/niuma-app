import { ensureDir, readDirRecursive } from "../fs";
import { getArtifactDirs, getEntryName, toRelativePath } from "../path-adapter";
import { buildTreeFromRelativeFiles } from "./build-tree";
import type { ArtifactTreeRoot } from "./types";

function isVisibleTreeEntry(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized) return false;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) {
    return false;
  }

  const leaf = segments[segments.length - 1] ?? "";
  if (leaf === ".niuma.keep") {
    return false;
  }

  return true;
}

export async function scanArtifactTree(): Promise<ArtifactTreeRoot[]> {
  const articleDirs = await getArtifactDirs().catch(() => [] as string[]);

  if (articleDirs.length === 0) {
    return [];
  }

  const files = await Promise.all(
    articleDirs.map(async (rootDir) => {
      await ensureDir(rootDir).catch(() => undefined);
      const entries = await readDirRecursive(rootDir).catch(() => []);

      return entries
        .filter((entry) => !entry.isDir)
        .map((entry) => {
          const relativePath = toRelativePath(rootDir, entry.path);
          return {
            rootDir,
            filePath: entry.path,
            relativePath,
          };
        })
        .filter((entry) => isVisibleTreeEntry(entry.relativePath));
    }),
  );

  const roots = buildTreeFromRelativeFiles(files.flat());
  const seenRootDirs = new Set(roots.map((root) => root.rootDir));

  for (const rootDir of articleDirs) {
    if (seenRootDirs.has(rootDir)) continue;
    roots.push({
      id: `root:${rootDir}`,
      name: getEntryName(rootDir) || rootDir,
      rootDir,
      children: [],
    });
  }

  return roots.sort((a, b) => a.name.localeCompare(b.name));
}
