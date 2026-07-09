import { useCallback, useEffect } from "react";
import { useMcpStore } from "@/store";
import type { McpServer } from "@/types";
import type { CreateInput, UpdateInput } from "@/data";

export type McpServerInput = CreateInput<McpServer>;

/** CRUD access to persisted MCP server records (repository-backed zustand store). */
export const useMcpServers = () => {
  const servers = useMcpStore((s) => s.items);
  const load = useMcpStore((s) => s.load);
  const add = useMcpStore((s) => s.add);
  const edit = useMcpStore((s) => s.edit);
  const removeItem = useMcpStore((s) => s.remove);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    (input: McpServerInput): Promise<McpServer> => add(input),
    [add]
  );

  const update = useCallback(
    (id: string, updates: UpdateInput<McpServer>) => edit(id, updates),
    [edit]
  );

  const remove = useCallback((id: string) => removeItem(id), [removeItem]);

  return { servers, refresh: load, create, update, remove };
};
