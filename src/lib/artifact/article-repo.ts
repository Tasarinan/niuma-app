import { join } from "@tauri-apps/api/path";
import { readDirRecursive, readText, writeText, ensureDir, getUniquePath } from "./fs";
import { getArtifactDirs, getArtifactDir, getEntryName, getParentPath, toRelativePath, toSlug } from "./path-adapter";

export type ArtifactArticle = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  filePath: string;
  relativePath: string;
};

function toTitleFromFileName(filePath: string, relativePath: string): string {
  const name = getEntryName(filePath);
  if (/^readme\.md$/i.test(name)) {
    const parent = getEntryName(getParentPath(relativePath));
    return parent || "README";
  }
  return name.replace(/\.md$/i, "") || "untitled";
}

export async function scanArtifactArticles(): Promise<ArtifactArticle[]> {
  const artifactDirs = await getArtifactDirs();
  const articles = await Promise.all(
    artifactDirs.map(async (artifactDir) => {
      await ensureDir(artifactDir);

      const entries = await readDirRecursive(artifactDir);
      const markdownFiles = entries.filter((entry) => !entry.isDir && /\.md$/i.test(entry.name));

      return Promise.all(
        markdownFiles.map(async (entry) => {
          const relativePath = toRelativePath(artifactDir, entry.path);
          const content = await readText(entry.path).catch(() => "");
          return {
            id: entry.path,
            title: toTitleFromFileName(entry.path, relativePath),
            content,
            updatedAt: new Date().toISOString(),
            filePath: entry.path,
            relativePath,
          } satisfies ArtifactArticle;
        }),
      );
    }),
  );

  return articles
    .flat()
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function openArtifactArticle(filePath: string): Promise<ArtifactArticle> {
  const artifactDirs = await getArtifactDirs();
  const matchedRoot = artifactDirs.find((rootDir) => {
    const normalizedRoot = rootDir.replace(/\\/g, "/").replace(/\/$/, "");
    const normalizedPath = filePath.replace(/\\/g, "/");
    return normalizedPath.startsWith(`${normalizedRoot}/`) || normalizedPath === normalizedRoot;
  });

  const relativePath = matchedRoot ? toRelativePath(matchedRoot, filePath) : getEntryName(filePath);
  const content = await readText(filePath);

  return {
    id: filePath,
    title: toTitleFromFileName(filePath, relativePath),
    content,
    updatedAt: new Date().toISOString(),
    filePath,
    relativePath,
  };
}

export async function saveArticleToArtifact(input: {
  title: string;
  content: string;
  existingPath?: string;
}): Promise<{ filePath: string; relativePath: string }> {
  const artifactDir = await getArtifactDir();
  await ensureDir(artifactDir);

  let filePath = input.existingPath;
  if (!filePath) {
    const slug = toSlug(input.title);
    const targetPath = await join(artifactDir, `${slug}.md`);
    filePath = await getUniquePath(targetPath);
  }

  await writeText(filePath, input.content);

  return {
    filePath,
    relativePath: toRelativePath(artifactDir, filePath),
  };
}
