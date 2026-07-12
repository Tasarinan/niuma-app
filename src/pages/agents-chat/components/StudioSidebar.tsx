import { useState } from "react";
import { Plus, Users, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioProject } from "@/types";
import { StudioAvatar } from "./StudioAvatar";

/** Left column: list of creation projects with inline create + delete. */
export function StudioSidebar({
  projects,
  selectedId,
  roleCounts,
  onSelect,
  onCreate,
  onDelete,
}: {
  projects: StudioProject[];
  selectedId: string | null;
  roleCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName("");
    setCreating(false);
  };

  return (
    <div className="flex h-full w-[188px] flex-shrink-0 flex-col border-r bg-muted/20">
      <div className="flex flex-shrink-0 items-center gap-2 px-3 py-2.5">
        <Users className="size-4 text-purple-400" />
        <span className="text-xs font-semibold tracking-wide">Projects</span>
        <button
          onClick={() => setCreating((c) => !c)}
          title="新建项目"
          className="ml-auto flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {creating && (
        <div className="flex items-center gap-1 px-2 pb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="项目名称"
            className="h-7 min-w-0 flex-1 rounded-lg border bg-background px-2 text-[11px] outline-none focus:border-fuchsia-400"
          />
          <button
            onClick={submit}
            className="flex size-6 items-center justify-center rounded-lg bg-fuchsia-500 text-white"
          >
            <Check className="size-3" />
          </button>
          <button
            onClick={() => setCreating(false)}
            className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2">
        {projects.length === 0 && !creating && (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            点击 + 新建创作项目
          </p>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
              selectedId === p.id
                ? "bg-fuchsia-500/10 text-foreground"
                : "hover:bg-muted/60"
            )}
          >
            <StudioAvatar avatar={p.avatar} name={p.name} className="size-6 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {roleCounts[p.id] ?? 0} 位角色
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(p.id);
              }}
              className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
