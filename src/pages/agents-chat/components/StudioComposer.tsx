import { useRef, useState } from "react";
import {
  Send,
  Square,
  Paperclip,
  ListChecks,
  Volume2,
  VolumeX,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StudioAttachment } from "@/types";
import type { SendOptions } from "@/hooks/useStudio";

function readFileAsAttachment(file: File): Promise<StudioAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isImage = file.type.startsWith("image/");
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const data = isImage
        ? result.replace(/^data:[^;]+;base64,/, "")
        : result;
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        kind: isImage ? "image" : "file",
        mimeType: file.type || "text/plain",
        data,
      });
    };
    reader.onerror = () => reject(reader.error);
    if (isImage) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

/** Bottom composer: attachments + plan mode + @mention + audio + send. */
export function StudioComposer({
  disabled,
  isSending,
  ttsEnabled,
  onToggleTts,
  onSend,
  onStop,
}: {
  disabled: boolean;
  isSending: boolean;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onSend: (text: string, opts: SendOptions) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const [planMode, setPlanMode] = useState(false);
  const [attachments, setAttachments] = useState<StudioAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: StudioAttachment[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        next.push(await readFileAsAttachment(file));
      } catch {
        /* ignore unreadable file */
      }
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isSending || disabled) return;
    onSend(text, {
      attachments: attachments.length ? attachments : undefined,
      planMode,
    });
    setInput("");
    setAttachments([]);
  };

  return (
    <div className="flex-shrink-0 border-t px-3 py-2.5">
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1 rounded-lg border bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground"
            >
              {a.kind === "image" ? (
                <ImageIcon className="size-3 text-fuchsia-500" />
              ) : (
                <Paperclip className="size-3" />
              )}
              <span className="max-w-24 truncate">{a.name}</span>
              <button
                onClick={() =>
                  setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                }
                className="hover:text-destructive"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Toolbar row */}
      <div className="mb-1.5 flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          title="添加附件（图片 / 文件）"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Paperclip className="size-3.5" />
        </button>
        <button
          title="计划模式：生成结构化创作大纲"
          disabled={disabled}
          onClick={() => setPlanMode((p) => !p)}
          className={cn(
            "flex h-6 items-center gap-1 rounded-lg px-2 text-[11px] transition-colors disabled:opacity-40",
            planMode
              ? "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ListChecks className="size-3.5" />
          计划
        </button>
        <button
          title={ttsEnabled ? "关闭语音朗读" : "开启语音朗读"}
          onClick={onToggleTts}
          className={cn(
            "flex size-6 items-center justify-center rounded-lg transition-colors",
            ttsEnabled
              ? "bg-blue-500/15 text-blue-500"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {ttsEnabled ? (
            <Volume2 className="size-3.5" />
          ) : (
            <VolumeX className="size-3.5" />
          )}
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          @点名角色 · Enter 发送
        </span>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          placeholder={
            disabled ? "先创建一个创作项目…" : "与角色们讨论创作…"
          }
          rows={1}
          className="max-h-28 min-h-[34px] flex-1 resize-none rounded-xl text-xs"
        />
        {isSending ? (
          <button
            onClick={onStop}
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-xl bg-muted hover:bg-muted/80"
          >
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || (!input.trim() && attachments.length === 0)}
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-white hover:bg-fuchsia-600 disabled:opacity-40"
          >
            <Send className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
