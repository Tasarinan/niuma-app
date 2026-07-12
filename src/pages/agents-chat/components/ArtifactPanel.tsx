import { useState } from "react";
import { FileText, Loader2, Trash2, FileEdit, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/types";
import { ArtifactEditor } from "./ArtifactEditor";

const STATUS_META: Record<
  Artifact["status"],
  { label: string; className: string }
> = {
  draft: { label: "草稿", className: "bg-muted text-muted-foreground" },
  generating: {
    label: "生成中",
    className: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  },
  done: { label: "完成", className: "bg-emerald-500/15 text-emerald-600" },
};

/** Right column: the shared documents (artifacts) produced by the team. */
export function ArtifactPanel({
  artifacts,
  generatingArtifactId,
  liveContent,
  isSending,
  onUpdate,
  onRemove,
  onRegenerate,
}: {
  artifacts: Artifact[];
  generatingArtifactId: string | null;
  liveContent: string;
  isSending: boolean;
  onUpdate: (id: string, patch: Partial<Artifact>) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string, instruction: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openArtifact = artifacts.find((a) => a.id === openId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <FileText className="size-4 text-fuchsia-500" />
        <span className="text-xs font-semibold">创作成果</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {artifacts.length}
        </span>
      </div>

      {artifacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          <FileText className="size-8 opacity-30" />
          <p className="text-[11px]">
            开启计划模式讨论并确认后，
            <br />
            文档会出现在这里
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
          {artifacts.map((a) => {
            const meta = STATUS_META[a.status];
            const isGen = generatingArtifactId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setOpenId(a.id)}
                className="group flex w-full flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-all hover:border-fuchsia-400/50 hover:shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 flex-shrink-0 text-fuchsia-500" />
                  <span className="truncate text-xs font-medium">{a.title}</span>
                  <span
                    className={cn(
                      "ml-auto flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                      meta.className
                    )}
                  >
                    {isGen ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <CircleDot className="size-2.5" />
                    )}
                    {meta.label}
                  </span>
                </div>
                <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                  {isGen
                    ? liveContent.slice(-160) || "正在创作…"
                    : a.content.trim()
                      ? a.content.replace(/[#*`>_-]/g, "").slice(0, 120)
                      : "空文档"}
                </p>
                <div className="flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
                  {a.authorAgentName && (
                    <span className="truncate">✍️ {a.authorAgentName}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <FileEdit
                      className="size-3 hover:text-fuchsia-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(a.id);
                      }}
                    />
                    <Trash2
                      className="size-3 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(a.id);
                      }}
                    />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ArtifactEditor
        artifact={openArtifact}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        isGenerating={openArtifact ? generatingArtifactId === openArtifact.id : false}
        liveContent={liveContent}
        isSending={isSending}
        onSave={(patch) => openArtifact && onUpdate(openArtifact.id, patch)}
        onRegenerate={(instruction) =>
          openArtifact && onRegenerate(openArtifact.id, instruction)
        }
      />
    </div>
  );
}
