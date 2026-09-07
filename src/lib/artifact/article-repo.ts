import { readDirRecursive, readText, writeText, ensureDir } from "./fs";
import { getArtifactDirs, getArtifactDir, getEntryName, toRelativePath } from "./path-adapter";
import { requireConfirmedDraftPath, isOpenableDraftMarkdown, isDraftArticleFile, normalizeDraftPath } from "./drafts";
import { displayTitleForDraftFile, applyMarkdownTitle } from "./unpublished-drafts";
import { normalizeFsPath } from "./workspace-path";
import {
  articleYamlPathFromArticle,
  parseArticleYamlMeta,
  upsertArticleYamlMeta,
} from "@/lib/wechat/article-yaml";

export type ArtifactArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  updatedAt: string;
  filePath: string;
  relativePath: string;
};

export async function scanArtifactArticles(): Promise<ArtifactArticle[]> {
  const artifactDirs = await getArtifactDirs();
  const articles = await Promise.all(
    artifactDirs.map(async (artifactDir) => {
      await ensureDir(artifactDir);

      const entries = await readDirRecursive(artifactDir);
      const markdownFiles = entries.filter((entry) => !entry.isDir && /\.md$/i.test(entry.name));

      return Promise.all(
        markdownFiles.map(async (entry) => {
          const relativePath = toRelativePath(normalizeFsPath(artifactDir), entry.path);
          const content = await readText(entry.path).catch(() => "");
          return {
            id: entry.path,
            title: displayTitleForDraftFile(entry.path, content),
            summary: "",
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
    .filter((article) => isDraftArticleFile(article.filePath) && isOpenableDraftMarkdown(article.filePath))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export type ArtifactArticleMeta = {
  summary: string;
};

export async function loadArtifactArticleMeta(filePath: string): Promise<ArtifactArticleMeta> {
  const yamlPath = articleYamlPathFromArticle(filePath);
  if (!yamlPath) return { summary: "" };
  try {
    const yaml = await readText(yamlPath);
    const meta = parseArticleYamlMeta(yaml);
    return { summary: meta.digest ?? "" };
  } catch {
    return { summary: "" };
  }
}

function titleAndSummaryFromYaml(
  filePath: string,
  content: string,
  yamlText: string,
): { title: string; summary: string } {
  const meta = parseArticleYamlMeta(yamlText);
  const title = displayTitleForDraftFile(filePath, content) || meta.title?.trim() || "";
  return { title, summary: meta.digest ?? "" };
}

export async function openArtifactArticle(filePath: string): Promise<ArtifactArticle> {
  const normalized = normalizeDraftPath(filePath);
  const artifactDirs = await getArtifactDirs();
  const matchedRoot = artifactDirs.find((rootDir) => {
    const normalizedRoot = normalizeFsPath(rootDir).replace(/\/$/, "");
    const normalizedPath = normalizeFsPath(normalized);
    return normalizedPath.startsWith(`${normalizedRoot}/`) || normalizedPath === normalizedRoot;
  });

  const relativePath = matchedRoot ? toRelativePath(matchedRoot, normalized) : getEntryName(normalized);
  const content = await readText(normalized);
  const yamlPath = articleYamlPathFromArticle(normalized);
  let title = displayTitleForDraftFile(normalized, content);
  let summary = "";
  if (yamlPath) {
    try {
      const yaml = await readText(yamlPath);
      const parsed = titleAndSummaryFromYaml(normalized, content, yaml);
      title = parsed.title;
      summary = parsed.summary;
    } catch {
      // keep markdown heading / folder title
    }
  }

  return {
    id: normalized,
    title,
    summary,
    content,
    updatedAt: new Date().toISOString(),
    filePath: normalized,
    relativePath,
  };
}

export async function saveArticleToArtifact(input: {
  title: string;
  content: string;
  summary?: string;
  existingPath?: string;
}): Promise<{ filePath: string; relativePath: string }> {
  const artifactDir = await getArtifactDir();
  await ensureDir(artifactDir);

  const filePath = normalizeDraftPath(requireConfirmedDraftPath(input.existingPath));
  const content = applyMarkdownTitle(input.content, input.title);
  await writeText(filePath, content);

  const yamlPath = articleYamlPathFromArticle(filePath);
  if (yamlPath) {
    let existing = "";
    try {
      existing = await readText(yamlPath);
    } catch {
      existing = "";
    }
    const patch: { title?: string; digest?: string } = {};
    if (input.title.trim()) patch.title = input.title.trim();
    if (input.summary !== undefined) patch.digest = input.summary.trim();
    await writeText(yamlPath, upsertArticleYamlMeta(existing, patch));
  }

  return {
    filePath,
    relativePath: toRelativePath(normalizeFsPath(artifactDir), filePath),
  };
}
