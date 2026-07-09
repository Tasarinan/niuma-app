import { useCallback, useEffect } from "react";
import { useSkillStore } from "@/store";
import type { Skill } from "@/types";
import type { CreateInput, UpdateInput } from "@/data";

export type SkillInput = CreateInput<Skill>;

/** CRUD access to persisted skills (repository-backed zustand store). */
export const useSkills = () => {
  const skills = useSkillStore((s) => s.items);
  const load = useSkillStore((s) => s.load);
  const add = useSkillStore((s) => s.add);
  const edit = useSkillStore((s) => s.edit);
  const removeItem = useSkillStore((s) => s.remove);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    (input: SkillInput): Promise<Skill> => add(input),
    [add]
  );

  const update = useCallback(
    (id: string, updates: UpdateInput<Skill>) => edit(id, updates),
    [edit]
  );

  const remove = useCallback((id: string) => removeItem(id), [removeItem]);

  return { skills, refresh: load, create, update, remove };
};
