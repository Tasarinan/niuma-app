import { FileText, Image as ImageIcon, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftWorkspaceFile } from "@/lib/artifact/draft-workspace";

function kindIcon(kind: DraftWorkspaceFile["kind"]) {
  if (kind === "review") return MessageSquareWarning;
  if (kind === "image") return ImageIcon;
  return FileText;
}

function kindLabel(kind: DraftWorkspaceFile["kind"]) {
  if (kind === "article") return "正文";
  if (kind === "topic") return "选题";
  if (kind === "review") return "审稿";
  if (kind === "image") return "配图";
  return "文件";
}

export function DraftWorkspacePanel({
  files,
  selectedPath,
  onSelect,
}: {
  files: DraftWorkspaceFile[];
  selectedPath?: string;
  onSelect: (file: DraftWorkspaceFile) => void;
}) {
  if (files.length === 0) {
    return (
      <p className="px-1 py-3 text-xs leading-relaxed text-slate-400">
        还没有打开一篇已定题的稿。在右侧对话里确认选题或继续未推送的稿之后，这里只列出这一篇的文件。
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {files.map((file) => {
        const Icon = kindIcon(file.kind);
        const selected = selectedPath?.replace(/\\/g, "/") === file.path.replace(/\\/g, "/");
        return (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => onSelect(file)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                selected ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-50",
              )}
              title={file.path}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{kindLabel(file.kind)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
