import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Folder, RefreshCw } from "lucide-react";
import type { ArtifactTreeNode } from "@/lib/artifact/tree";
import { cn } from "@/lib/utils";
import { TreeContextMenu } from "./TreeContextMenu";
import { TreeNode } from "./TreeNode";
import type { ArtifactTreeProps } from "./types";

function collectFolderIds(nodes: ArtifactTreeNode[]): string[] {
  const ids: string[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.kind === "folder") {
      ids.push(current.id);
    }
    stack.push(...current.children);
  }
  return ids;
}

function countFiles(nodes: ArtifactTreeNode[]): number {
  let total = 0;
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.kind === "file") {
      total += 1;
      continue;
    }
    stack.push(...current.children);
  }
  return total;
}

export function ArtifactTree(props: ArtifactTreeProps) {
  const {
    roots,
    selectedFilePath,
    onSelectFile,
    onRefresh,
    direction = "rtl",
    showPath = true,
    showHeader = true,
  } = props;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { t } = useTranslation("pages");
  const totalFiles = useMemo(
    () => roots.reduce((sum, root) => sum + countFiles(root.children), 0),
    [roots],
  );

  const expandedWithDefaults = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    for (const root of roots) {
      defaults[root.id] = true;
      for (const folderId of collectFolderIds(root.children)) {
        defaults[folderId] = true;
      }
    }
    return { ...defaults, ...expanded };
  }, [expanded, roots]);

  const toggle = (id: string) => {
    setExpanded((current) => ({
      ...current,
      [id]: !expandedWithDefaults[id],
    }));
  };

  return (
    <TreeContextMenu>
      <div dir={direction} className="rounded-xl border border-slate-200 bg-white p-2">
        {showHeader && (
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                {t("articles.artifactTree.title")}
              </div>
              <div className="text-[11px] text-slate-500">
                {t("articles.artifactTree.summary", { roots: roots.length, files: totalFiles })}
              </div>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title={t("articles.artifactTree.refresh")}
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {roots.length === 0 ? (
          <div className="px-2 py-2 text-xs text-slate-400">{t("articles.artifactTree.empty")}</div>
        ) : (
          <div className="space-y-1">
            {roots.map((root) => {
              const rootOpen = !!expandedWithDefaults[root.id];
              return (
                <div key={root.id}>
                  <button
                    type="button"
                    onClick={() => toggle(root.id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100",
                      direction === "rtl" ? "flex-row-reverse text-right" : "text-left",
                    )}
                    title={root.rootDir}
                  >
                    {rootOpen ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    <Folder className="size-3.5 text-amber-600" />
                    <span className="truncate">{root.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {countFiles(root.children)}
                    </span>
                  </button>
                  {showPath && (
                    <div className={cn("px-2 pb-1 text-[11px] text-slate-400", direction === "rtl" ? "text-right" : "text-left")}>
                      {root.rootDir}
                    </div>
                  )}

                  {rootOpen &&
                    (root.children.length > 0 ? (
                      root.children.map((node) => (
                        <TreeNode
                          key={node.id}
                          node={node}
                          depth={1}
                          expanded={expandedWithDefaults}
                          selectedFilePath={selectedFilePath}
                          onToggle={toggle}
                          onSelectFile={onSelectFile}
                          direction={direction}
                          showPath={showPath}
                        />
                      ))
                    ) : (
                      <div className={cn("px-2 py-1 text-[11px] text-slate-400", direction === "rtl" ? "text-right" : "text-left")}>
                        {t("articles.artifactTree.emptyRoot")}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TreeContextMenu>
  );
}
