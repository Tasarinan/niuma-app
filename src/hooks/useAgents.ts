import { useCallback, useEffect } from "react";
import { useAgentStore } from "@/store";
import type { AgentDefinition } from "@/types";
import type { CreateInput, UpdateInput } from "@/data";
import { seedDefaultAgentsIfEmpty } from "@/lib/agent";

export type AgentInput = CreateInput<AgentDefinition>;

/** CRUD access to persisted agent definitions (repository-backed zustand store). */
export const useAgents = () => {
  const agents = useAgentStore((s) => s.items);
  const load = useAgentStore((s) => s.load);
  const add = useAgentStore((s) => s.add);
  const edit = useAgentStore((s) => s.edit);
  const removeItem = useAgentStore((s) => s.remove);

  useEffect(() => {
    void load().then(() => {
      // If no agents in store, seed from bundled public/agents/ defaults
      if (useAgentStore.getState().items.length === 0) {
        void seedDefaultAgentsIfEmpty().then(() => void load());
      }
    });
  }, [load]);

  const create = useCallback(
    (input: AgentInput): Promise<AgentDefinition> => add(input),
    [add]
  );

  const update = useCallback(
    (id: string, updates: UpdateInput<AgentDefinition>) => edit(id, updates),
    [edit]
  );

  const remove = useCallback((id: string) => removeItem(id), [removeItem]);

  return { agents, refresh: load, create, update, remove };
};
