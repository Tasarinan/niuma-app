import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockStyle, ShadowLevel, TextAlign } from "@/lib/wechat/block-style";
import { compactBlockStyle } from "@/lib/wechat/block-style";
import { blockTypeAtSelection } from "./block-style";

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24];
const ALIGNS: TextAlign[] = ["left", "center", "right", "justify"];
const SHADOWS: ShadowLevel[] = ["none", "sm", "md", "lg"];

type Props = { editor: Editor | null; embedded?: boolean };

export function BlockStylePanel({ editor, embedded }: Props) {
  const [style, setStyle] = useState<BlockStyle>({});
  const [blockType, setBlockType] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const inTable = blockType === "table";

  useEffect(() => {
    if (!editor) {
      setStyle({});
      setBlockType(null);
      return;
    }
    const sync = () => {
      const type = blockTypeAtSelection(editor);
      setBlockType(type);
      const attrs = type ? editor.getAttributes(type) : {};
      setStyle(compactBlockStyle((attrs.nmStyle as BlockStyle | null) ?? null) ?? {});
    };
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor]);

  const patch = (next: BlockStyle) => {
    editor?.chain().focus().setBlockStyle(next).run();
  };

  return (
    <div className="space-y-3">
      {embedded ? null : (
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] font-medium uppercase tracking-widest text-slate-400 hover:bg-slate-50"
      >
        块样式
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      )}
      {!(embedded || open) ? null : !editor || !blockType ? (
        <p className="px-1 text-xs leading-relaxed text-slate-400">点选一段正文或一个块后，可改字号和外观。块级样式优先于排版主题。</p>
      ) : (
        <>
          <p className="text-[11px] text-slate-400">当前：{blockType}</p>
          <label className="block text-[11px] text-slate-500">
            字号
            <select
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
              value={style.fontSize ?? ""}
              onChange={(event) =>
                patch({ fontSize: event.target.value ? Number(event.target.value) : undefined })
              }
            >
              <option value="">主题默认</option>
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-slate-500">
            行高
            <input
              type="number"
              step="0.05"
              min={1}
              max={3}
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={style.lineHeight ?? ""}
              placeholder="1.8"
              onChange={(event) =>
                patch({ lineHeight: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            字间距
            <input
              type="number"
              step="0.1"
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={style.letterSpacing ?? ""}
              placeholder="0"
              onChange={(event) =>
                patch({
                  letterSpacing: event.target.value ? Number(event.target.value) : undefined,
                })
              }
            />
          </label>
          <div className="flex gap-1">
            {ALIGNS.map((align) => (
              <button
                key={align}
                type="button"
                className={`h-7 flex-1 rounded-md text-[10px] ${
                  style.textAlign === align ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-500"
                }`}
                onClick={() => patch({ textAlign: align })}
              >
                {align === "left" ? "左" : align === "center" ? "中" : align === "right" ? "右" : "两端"}
              </button>
            ))}
          </div>
          <label className="block text-[11px] text-slate-500">
            缩进
            <input
              type="number"
              min={0}
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={style.indent ?? ""}
              placeholder="0"
              onChange={(event) =>
                patch({ indent: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            颜色
            <input
              type="color"
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white"
              value={style.color ?? "#333333"}
              onChange={(event) => patch({ color: event.target.value })}
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            背景
            <input
              type="color"
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white"
              value={style.background ?? "#ffffff"}
              onChange={(event) => patch({ background: event.target.value })}
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            圆角
            <input
              type="number"
              min={0}
              max={64}
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              value={style.borderRadius ?? ""}
              placeholder="0"
              onChange={(event) =>
                patch({ borderRadius: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            阴影
            <select
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
              value={style.boxShadow ?? "none"}
              onChange={(event) => patch({ boxShadow: event.target.value as ShadowLevel })}
            >
              {SHADOWS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-slate-500">
            边框
            <select
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
              value={style.borderStyle ?? "none"}
              onChange={(event) =>
                patch({
                  borderStyle: event.target.value as BlockStyle["borderStyle"],
                  borderWidth: event.target.value === "none" ? undefined : style.borderWidth ?? 1,
                  borderColor: event.target.value === "none" ? undefined : style.borderColor ?? "#EEEEEE",
                })
              }
            >
              <option value="none">无</option>
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="dotted">点线</option>
            </select>
          </label>
          {style.borderStyle && style.borderStyle !== "none" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-slate-500">
                边框宽度
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
                  value={style.borderWidth ?? 1}
                  onChange={(event) =>
                    patch({
                      borderWidth: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="block text-[11px] text-slate-500">
                边框颜色
                <input
                  type="color"
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white"
                  value={style.borderColor ?? "#EEEEEE"}
                  onChange={(event) => patch({ borderColor: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          <button
            type="button"
            className="w-full rounded-md border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            onClick={() => editor?.chain().focus().unsetBlockStyle().run()}
          >
            重置为本块主题默认
          </button>
          {inTable && (
            <div className="grid grid-cols-2 gap-1 pt-1">
              <button type="button" className="rounded-md bg-slate-50 py-1.5 text-[11px]" onClick={() => editor?.chain().focus().addRowAfter().run()}>
                加行
              </button>
              <button type="button" className="rounded-md bg-slate-50 py-1.5 text-[11px]" onClick={() => editor?.chain().focus().addColumnAfter().run()}>
                加列
              </button>
              <button type="button" className="rounded-md bg-slate-50 py-1.5 text-[11px]" onClick={() => editor?.chain().focus().deleteRow().run()}>
                删行
              </button>
              <button type="button" className="rounded-md bg-slate-50 py-1.5 text-[11px]" onClick={() => editor?.chain().focus().deleteColumn().run()}>
                删列
              </button>
              <button
                type="button"
                className="col-span-2 rounded-md bg-slate-50 py-1.5 text-[11px] text-rose-600"
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                删除表格
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
