import { useState } from "react";
import { ChevronRight, Wrench, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioToolCall } from "@/types";

/** Compact, collapsible card for a single PI tool call (skills / MCP / internal). */
export function ToolCallCard({ tool }: { tool: StudioToolCall }) {
  const [open, setOpen] = useState(false);
  const argsText =
    typeof tool.args === "string"
      ? tool.args
      : JSON.stringify(tool.args ?? {}, null, 2);

  return (
    <div
      className={cn(
        "rounded-lg border text-[11px] transition-colors",
        tool.isError
          ? "border-destructive/40 bg-destructive/5"
          : "border-border/70 bg-muted/40"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
      >
        <ChevronRight
          className={cn(
            "size-3 flex-shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <Wrench className="size-3 flex-shrink-0 text-fuchsia-500" />
        <span className="font-mono font-medium text-foreground/80">
          {tool.toolName}
        </span>
        <span className="ml-auto flex-shrink-0">
          {!tool.done ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : tool.isError ? (
            <XCircle className="size-3 text-destructive" />
          ) : (
            <CheckCircle2 className="size-3 text-emerald-500" />
          )}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border/60 px-2 py-1.5">
          <div>
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              参数
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5 font-mono text-[10px] leading-relaxed">
              {argsText || "{}"}
            </pre>
          </div>
          {tool.resultText != null && (
            <div>
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                结果
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5 font-mono text-[10px] leading-relaxed">
                {tool.resultText || "（无输出）"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
