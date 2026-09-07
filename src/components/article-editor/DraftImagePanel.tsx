import { ImagePlus, LoaderCircle, Sparkles, Upload } from "lucide-react";
import type { DraftGalleryItem } from "@/lib/artifact/draft-workspace";
import { cn } from "@/lib/utils";

export function DraftImagePanel({
  items,
  disabled,
  generatingId,
  onUpload,
  onGenerate,
  onInsert,
}: {
  items: DraftGalleryItem[];
  disabled?: boolean;
  generatingId?: string | null;
  onUpload: (file: File) => void;
  onGenerate: (item?: DraftGalleryItem) => void;
  onInsert?: (item: DraftGalleryItem) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-1">
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Upload className="size-3" />
          上传
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGenerate()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Sparkles className="size-3" />
          生成
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-xs leading-relaxed text-slate-400">
          还没有配图。可以上传，或贴一段参考 Prompt 生成。
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const busy = generatingId === item.id;
            const label = item.relativeSrc || item.name;
            return (
              <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={!item.dataUrl || disabled}
                  onClick={() => item.dataUrl && onInsert?.(item)}
                  className="block w-full"
                  title={item.dataUrl ? "插入正文" : item.title}
                >
                  {item.dataUrl ? (
                    <img src={item.dataUrl} alt={item.title} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-20 items-center justify-center bg-slate-50 text-slate-300">
                      <ImagePlus className="size-5" />
                    </div>
                  )}
                </button>
                <div className="space-y-1.5 px-2 py-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-slate-700" title={item.title}>
                        {item.title}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-400" title={label}>
                        {label}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => onGenerate(item)}
                      className="shrink-0 text-[10px] text-indigo-600 hover:text-indigo-800 disabled:text-slate-300"
                    >
                      {busy ? <LoaderCircle className="size-3 animate-spin" /> : "生成"}
                    </button>
                  </div>
                  {item.prompt ? (
                    <p className="line-clamp-4 whitespace-pre-wrap text-[11px] leading-snug text-slate-500">
                      {item.prompt}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300">没有 Prompt。点生成可填写后出图。</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
