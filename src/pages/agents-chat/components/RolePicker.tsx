import { Check, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AgentDefinition } from "@/types";
import { StudioAvatar } from "./StudioAvatar";

/** Talent-market style picker to add/remove agent roles on a project. */
export function RolePicker({
  agents,
  selectedIds,
  onAdd,
  onRemove,
  disabled,
}: {
  agents: AgentDefinition[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          disabled={disabled}
          title="邀请角色"
          className="flex size-7 items-center justify-center rounded-full border border-dashed border-fuchsia-400/60 text-fuchsia-500 transition-colors hover:bg-fuchsia-500/10 disabled:opacity-40"
        >
          <UserPlus className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-fuchsia-500" />
            邀请创作角色
          </DialogTitle>
          <DialogDescription className="text-xs">
            从你的智能体中挑选参与本项目共创的角色
          </DialogDescription>
        </DialogHeader>
        {agents.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            还没有智能体，请先在「智能体」中创建
          </p>
        ) : (
          <div className="grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto py-1">
            {agents.map((agent) => {
              const active = selectedIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() =>
                    active ? onRemove(agent.id) : onAdd(agent.id)
                  }
                  className={cn(
                    "group relative flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all",
                    active
                      ? "border-fuchsia-500/60 bg-fuchsia-500/5"
                      : "border-border hover:border-fuchsia-400/40 hover:bg-muted/40"
                  )}
                >
                  <StudioAvatar
                    avatar={agent.avatar}
                    name={agent.name}
                    className="size-9 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{agent.name}</p>
                    {agent.role && (
                      <p className="truncate text-[10px] text-fuchsia-500">
                        {agent.role}
                      </p>
                    )}
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-fuchsia-500 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
