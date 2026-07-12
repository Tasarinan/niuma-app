import { useCallback, useEffect, useMemo } from "react";
import { useArtifactStore } from "@/store";
import type { Artifact } from "@/types";
import type { CreateInput, UpdateInput } from "@/lib/data";

/**
 * Project-scoped access to co-authored artifacts. Wraps the global
 * repository-backed collection store and filters to one Studio project.
 */
export const useArtifacts = (projectId: string | null) => {
  const all = useArtifactStore((s) => s.items);
  const loaded = useArtifactStore((s) => s.loaded);
  const load = useArtifactStore((s) => s.load);
  const add = useArtifactStore((s) => s.add);
  const edit = useArtifactStore((s) => s.edit);
  const removeItem = useArtifactStore((s) => s.remove);

  useEffect(() => {
    void load();
  }, [load]);

  const artifacts = useMemo(
    () => (projectId ? all.filter((a) => a.projectId === projectId) : []),
    [all, projectId]
  );

  const create = useCallback(
    (input: CreateInput<Artifact>): Promise<Artifact> => add(input),
    [add]
  );
  const update = useCallback(
    (id: string, patch: UpdateInput<Artifact>) => edit(id, patch),
    [edit]
  );
  const remove = useCallback((id: string) => removeItem(id), [removeItem]);

  return { artifacts, loaded, create, update, remove, refresh: load };
};
