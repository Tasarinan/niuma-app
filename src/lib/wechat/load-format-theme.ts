import { invoke } from "@tauri-apps/api/core";
import { readText } from "@/lib/artifact/fs";
import { resolveWorkspacePath } from "@/lib/artifact/workspace-path";
import { buildResolvedStyles, parseFormatThemeYaml } from "./format-theme-css";
import { FORMAT_THEME_BUILTIN_DIR, FORMAT_THEME_USER_DIR } from "./format-themes";

const cache = new Map<string, Record<string, string>>();

export async function loadFormatThemeStyles(themeId: string): Promise<Record<string, string>> {
  const id = themeId.trim() || "default";
  const hit = cache.get(id);
  if (hit) return hit;
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) throw new Error("没有工作区根路径，无法加载排版主题");
  for (const dir of [FORMAT_THEME_USER_DIR, FORMAT_THEME_BUILTIN_DIR]) {
    for (const ext of [".yaml", ".yml"] as const) {
      const path = resolveWorkspacePath(root, `${dir}/${id}${ext}`);
      try {
        const raw = await readText(path);
        const styles = buildResolvedStyles(parseFormatThemeYaml(raw));
        cache.set(id, styles);
        return styles;
      } catch {
        continue;
      }
    }
  }
  throw new Error(`找不到排版主题 ${id}`);
}
