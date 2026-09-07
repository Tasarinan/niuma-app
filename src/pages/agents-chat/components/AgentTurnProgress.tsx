import { Check, LoaderCircle, X } from "lucide-react";
import type { GroupToolProgress } from "@/types";
import { cn } from "@/lib/utils";
import { describeAgentToolDone } from "@/lib/agent/tool-progress";

export function AgentTurnProgress({
  steps,
  streaming,
}: {
  steps?: GroupToolProgress[];
  streaming?: boolean;
}) {
  const showThinking = Boolean(streaming) && !(steps && steps.length > 0);
  if (!showThinking && !steps?.length) return null;

  return (
    <div className="mb-2 space-y-1.5">
      {showThinking && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <LoaderCircle className="size-3.5 animate-spin" />
          <span>正在思考…</span>
        </div>
      )}
      {steps?.map((step) => (
        <div
          key={step.toolCallId}
          className={cn(
            "flex items-center gap-2 text-xs",
            step.isError ? "text-red-600" : "text-slate-500",
          )}
        >
          {step.done ? (
            step.isError ? <X className="size-3.5" /> : <Check className="size-3.5 text-emerald-600" />
          ) : (
            <LoaderCircle className="size-3.5 animate-spin" />
          )}
          <span>{step.done ? describeAgentToolDone(step.label) : step.label}</span>
        </div>
      ))}
    </div>
  );
}
