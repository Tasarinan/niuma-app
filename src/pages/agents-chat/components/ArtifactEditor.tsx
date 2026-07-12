import { useEffect, useState } from "react";
import { Eye, Pencil, Save, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
  Input,
  Button,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components";
import type { Artifact } from "@/types";

/** Full document editor: Markdown preview / raw edit / AI regenerate. */
export function ArtifactEditor({
  artifact,
  open,
  onOpenChange,
  isGenerating,
  liveContent,
  isSending,
  onSave,
  onRegenerate,
}: {
  artifact: Artifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGenerating: boolean;
  liveContent: string;
  isSending: boolean;
  onSave: (patch: { title?: string; content?: string }) => void;
  onRegenerate: (instruction: string) => void;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    if (artifact) {
      setTitle(artifact.title);
      setContent(artifact.content);
      setMode("preview");
      setInstruction("");
    }
  }, [artifact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!artifact) return null;
  const shownContent = isGenerating ? liveContent : content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="flex-shrink-0 flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          {mode === "edit" ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 max-w-xs text-sm font-semibold"
            />
          ) : (
            <DialogTitle className="truncate text-sm">
              {artifact.title}
            </DialogTitle>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant={mode === "preview" ? "secondary" : "ghost"}
              onClick={() => setMode("preview")}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Eye className="size-3" /> 预览
            </Button>
            <Button
              size="sm"
              variant={mode === "edit" ? "secondary" : "ghost"}
              onClick={() => setMode("edit")}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Pencil className="size-3" /> 编辑
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isGenerating ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] text-fuchsia-500">
                <Loader2 className="size-3 animate-spin" /> 正在创作…
              </p>
              <Markdown>{shownContent || "…"}</Markdown>
            </div>
          ) : mode === "edit" ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[45vh] resize-none font-mono text-xs leading-relaxed"
              placeholder="用 Markdown 编写文档正文…"
            />
          ) : content.trim() ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">
              还没有内容，去和角色讨论并确认计划，或点击下方「重新生成」
            </p>
          )}
        </div>

        <div className="flex-shrink-0 space-y-2 border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isSending}
              placeholder="让 AI 修改本文档（例如：更正式、加个结尾…）"
              className="h-8 flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && instruction.trim()) {
                  onRegenerate(instruction.trim());
                  setInstruction("");
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={isSending || !instruction.trim()}
              onClick={() => {
                onRegenerate(instruction.trim());
                setInstruction("");
              }}
              className="h-8 gap-1 text-[11px]"
            >
              {isSending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              重写
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                onSave({ title, content });
                onOpenChange(false);
              }}
              disabled={isGenerating}
              className={cn("h-8 gap-1 bg-fuchsia-500 text-[11px] hover:bg-fuchsia-600")}
            >
              <Save className="size-3" /> 保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
