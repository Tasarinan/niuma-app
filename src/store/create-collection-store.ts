import { create } from "zustand";
import i18n from "@/lib/i18n";
import type { BaseEntity } from "@/types";
import type { CreateInput, Repository, UpdateInput } from "@/lib/data";

export interface CollectionState<T extends BaseEntity> {
  items: T[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: CreateInput<T>) => Promise<T>;
  edit: (id: string, patch: UpdateInput<T>) => Promise<T | null>;
  remove: (id: string) => Promise<void>;
}

export function createCollectionStore<T extends BaseEntity>(
  repo: Repository<T>
) {
  return create<CollectionState<T>>((set, get) => ({
    items: [],
    loading: false,
    loaded: false,
    error: null,

    load: async () => {
      if (get().loading) return;
      set({ loading: true, error: null });
      try {
        const items = await repo.list();
        set({ items, loading: false, loaded: true });
      } catch (e) {
        set({
          loading: false,
          error:
            e instanceof Error
              ? e.message
              : i18n.t("loadFailed", { ns: "errors" }),
        });
      }
    },

    add: async (input) => {
      const created = await repo.create(input);
      set({ items: [created, ...get().items] });
      return created;
    },

    edit: async (id, patch) => {
      const updated = await repo.update(id, patch);
      if (updated) {
        set({
          items: get().items.map((item) => (item.id === id ? updated : item)),
        });
      }
      return updated;
    },

    remove: async (id) => {
      await repo.remove(id);
      set({ items: get().items.filter((item) => item.id !== id) });
    },
  }));
}
