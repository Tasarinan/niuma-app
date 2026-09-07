import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleBlockPreset } from "@/lib/content/article-block-presets";
import { loadArticleBlockPresets } from "@/lib/content/load-article-block-presets";

type Props = {
  disabled?: boolean;
  onInsert: (preset: ArticleBlockPreset) => void;
  embedded?: boolean;
};

export function ArticleBlockPresetPanel({ disabled, onInsert, embedded }: Props) {
  const [open, setOpen] = useState(true);
  const [presets, setPresets] = useState<ArticleBlockPreset[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadArticleBlockPresets()
      .then((items) => {
        if (!cancelled) setPresets(items);
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {embedded ? null : (
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mb-1.5 flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] font-medium uppercase tracking-widest text-slate-400 hover:bg-slate-50"
      >
        模板
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      )}
      {!(embedded || open) ? null : presets.length === 0 ? (
        <p className="px-1 text-xs leading-relaxed text-slate-400">
          还没有模板。文案在内容团队 presets/article-blocks/。
        </p>
      ) : (
        <div className="space-y-1">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onInsert(preset)}
              className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50"
            >
              <div className="text-xs font-medium text-slate-700">{preset.name}</div>
              {preset.description ? (
                <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{preset.description}</div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
