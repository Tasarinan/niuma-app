import { invoke } from "@tauri-apps/api/core";
import { readText } from "@/lib/artifact/fs";
import { resolveWorkspacePath } from "@/lib/artifact/workspace-path";
import {
  ARTICLE_BLOCK_INDEX_REL,
  ARTICLE_BLOCK_PRESET_DIR,
  parseArticleBlockIndex,
  type ArticleBlockPreset,
} from "./article-block-presets";

export async function loadArticleBlockPresets(): Promise<ArticleBlockPreset[]> {
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return [];
  const indexPath = resolveWorkspacePath(root, ARTICLE_BLOCK_INDEX_REL);
  let raw = "";
  try {
    raw = await readText(indexPath);
  } catch {
    return [];
  }
  const metas = parseArticleBlockIndex(raw);
  const loaded = await Promise.all(
    metas.map(async (meta) => {
      const path = resolveWorkspacePath(root, `${ARTICLE_BLOCK_PRESET_DIR}/${meta.file}`);
      try {
        const markdown = await readText(path);
        return { ...meta, markdown };
      } catch {
        return null;
      }
    }),
  );
  return loaded.filter((item): item is ArticleBlockPreset => Boolean(item?.markdown.trim()));
}
