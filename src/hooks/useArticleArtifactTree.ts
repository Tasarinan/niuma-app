import { useCallback, useState } from "react";
import { scanArtifactTree, type ArtifactTreeRoot } from "@/lib/artifact/tree";

export function useArticleArtifactTree() {
  const [treeRoots, setTreeRoots] = useState<ArtifactTreeRoot[]>([]);

  const refreshTree = useCallback(async () => {
    try {
      const next = await scanArtifactTree();
      setTreeRoots(next);
    } catch {
      setTreeRoots((current) => current);
    }
  }, []);

  return {
    treeRoots,
    refreshTree,
  };
}
