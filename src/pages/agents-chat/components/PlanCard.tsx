import { ListChecks, Check, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StudioMessage } from "@/types";

/**
 * Structured Planning card: shows the proposed creation plan and lets the human
 * confirm, which spins up an artifact draft per plan item.
 */
export function PlanCard({
  message,
  onConfirm,
  isBusy,
}: {
  message: StudioMessage;
  onConfirm: () => void;
  isBusy: boolean;
}) {
  const plan = message.plan;
  if (!plan) return null;
  const confirmed = !!plan.confirmed;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5">
      <div className="flex items-center gap-1.5 border-b border-fuchsia-500/20 px-3 py-2">
        <ListChecks className="size-3.5 text-fuchsia-500" />
        <span className="text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">
          创作计划 · {plan.plans.length} 项
        </span>
        {confirmed && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
            <Check className="size-3" /> 已确认
          </span>
        )}
      </div>
      <ol className="divide-y divide-fuchsia-500/10">
        {plan.plans.map((item, i) => (
          <li key={i} className="flex gap-2 px-3 py-2">
            <span className="mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-[9px] font-bold text-fuchsia-600">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                <FileText className="size-3 flex-shrink-0 text-muted-foreground" />
                {item.title}
              </p>
              {item.summary && (
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!confirmed && (
        <div className="flex justify-end gap-2 border-t border-fuchsia-500/20 px-3 py-2">
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isBusy}
            className={cn(
              "h-7 gap-1.5 bg-fuchsia-500 px-3 text-[11px] hover:bg-fuchsia-600"
            )}
          >
            {isBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            确认并开始创作
          </Button>
        </div>
      )}
    </div>
  );
}
