import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Pencil,
  TextCursorInput,
  WandSparkles,
} from "lucide-react";
import {
  extractImagePrompt,
  isWholeArticleSelection,
  resolveAssistRange,
  type AssistRangeSnapshot,
  type EditorAssistKind,
} from "@/lib/content/editor-assist";
import { runEditorAssist } from "@/lib/content/editor-assist-run";
import type { ContentRosterCopy } from "@/lib/content/roster-workflow";
import {
  describeWechatPipelineError,
  resolveWorkspaceRoot,
  runWechatFormatForDraft,
} from "@/lib/content/wechat-draft-pipeline";
import { cn } from "@/lib/utils";

interface Props {
  editor: Editor | null;
  draftDirAbs?: string | null;
  teamId?: string;
  rosterCopy?: ContentRosterCopy;
  onBeforeFormat: () => Promise<void>;
  onPrepareImage: (prompt: string, at: number) => void;
}

type Busy = EditorAssistKind | "format-document" | null;

type DraftKind = "edit" | "continue" | "format-selection" | "review";

interface AssistDraft {
  kind: DraftKind;
  range: AssistRangeSnapshot;
  text: string;
  whole: boolean;
}

function snapshotFromEditor(editor: Editor): AssistRangeSnapshot {
  const { from, to, empty } = editor.state.selection;
  const $from = editor.state.selection.$from;
  return resolveAssistRange({
    from,
    to,
    empty,
    blockFrom: $from.start(),
    blockTo: $from.end(),
    selectedText: editor.state.doc.textBetween(from, to, "\n"),
    blockText: editor.state.doc.textBetween($from.start(), $from.end(), "\n"),
  });
}

function clampRange(editor: Editor, range: AssistRangeSnapshot): AssistRangeSnapshot {
  const size = editor.state.doc.content.size;
  const from = Math.max(1, Math.min(range.from, size));
  const to = Math.max(from, Math.min(range.to, size));
  return { from, to, text: range.text };
}

function cardStyle(editor: Editor, to: number): CSSProperties | undefined {
  try {
    const end = editor.view.coordsAtPos(Math.max(1, to));
    const root = editor.view.dom.parentElement;
    if (!root) {
      return { position: "fixed", top: end.bottom + 8, left: end.left, width: 440, zIndex: 40 };
    }
    const rect = root.getBoundingClientRect();
    return {
      position: "absolute",
      top: end.bottom - rect.top + root.scrollTop + 8,
      left: Math.min(Math.max(12, end.left - rect.left), Math.max(12, root.clientWidth - 452)),
      width: Math.min(440, root.clientWidth - 24),
      zIndex: 40,
    };
  } catch {
    return undefined;
  }
}

export function EditorAssistPanel({ editor, draftDirAbs, teamId, rosterCopy, onBeforeFormat, onPrepareImage }: Props) {
  const rangeRef = useRef<AssistRangeSnapshot | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [draft, setDraft] = useState<AssistDraft | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editor) return;
    const capture = () => {
      if (draft) return;
      rangeRef.current = snapshotFromEditor(editor);
    };
    capture();
    editor.on("selectionUpdate", capture);
    editor.on("update", capture);
    return () => {
      editor.off("selectionUpdate", capture);
      editor.off("update", capture);
    };
  }, [editor, draft]);

  const agentNames = useMemo(
    () => ({
      writerName: rosterCopy?.writerName,
      reviewerName: rosterCopy?.reviewerName,
      imageName: rosterCopy?.imageName,
      formatterName: rosterCopy?.publisherName,
    }),
    [rosterCopy],
  );

  if (!editor) return null;

  const holdSelection = (event: MouseEvent) => {
    event.preventDefault();
  };

  const run = async (action: "edit" | "continue" | "review" | "format" | "image") => {
    const range = clampRange(editor, rangeRef.current ?? snapshotFromEditor(editor));
    const document = editor.getMarkdown();
    if (!range.text.trim()) return;
    const whole = isWholeArticleSelection(range.text, document);
    setError("");
    if (action === "format" && whole) {
      if (!draftDirAbs) {
        setError("先打开一篇稿。");
        return;
      }
      setBusy("format-document");
      try {
        await onBeforeFormat();
        const root = await resolveWorkspaceRoot();
        if (!root) throw new Error("找不到工作区根目录。");
        const result = await runWechatFormatForDraft({ draftDirAbs, workspaceRoot: root });
        const detail = describeWechatPipelineError(result);
        setDraft({
          kind: "review",
          range,
          whole,
          text: result.ok ? `已按当前主题生成公众号 HTML。${(result.stdout || "").trim()}` : detail,
        });
      } catch (err) {
        setError(
          describeWechatPipelineError({
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        setBusy(null);
      }
      return;
    }
    const kind: EditorAssistKind =
      action === "review"
        ? whole
          ? "review-document"
          : "review-selection"
        : action === "format"
          ? "format-selection"
          : action;
    setBusy(kind);
    try {
      const text = await runEditorAssist({
        kind,
        target: range.text,
        document,
        instruction: action === "image" && whole ? "主题封面" : "",
        teamId: teamId?.trim() || "content",
        agentNames,
      });
      if (action === "image") {
        const prompt = extractImagePrompt(text);
        if (!prompt) {
          setError("没有得到配图说明。");
          return;
        }
        onPrepareImage(prompt, whole ? 1 : range.to);
        return;
      }
      setDraft({
        kind: action === "review" ? "review" : action === "format" ? "format-selection" : action,
        range,
        whole,
        text,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const accept = () => {
    if (!draft || draft.kind === "review") {
      setDraft(null);
      return;
    }
    const range = clampRange(editor, draft.range);
    if (draft.kind === "continue") {
      const block = draft.text.endsWith("\n") ? draft.text : `${draft.text}\n`;
      editor.chain().insertContentAt(range.to, `\n${block}`, { contentType: "markdown" }).run();
    } else {
      editor.chain().insertContentAt({ from: range.from, to: range.to }, draft.text, { contentType: "markdown" }).run();
    }
    setDraft(null);
  };

  const iconBtn = (label: string, onClick: () => void, icon: ReactNode, active?: boolean) => (
    <button
      type="button"
      title={label}
      disabled={busy != null}
      onMouseDown={holdSelection}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40",
        active && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
      )}
    >
      {icon}
    </button>
  );

  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="niuma-assist-bubble"
        options={{ placement: "top", offset: 8 }}
        shouldShow={({ state }) => {
          if (draft || busy) return false;
          const { from, to, empty } = state.selection;
          return !empty && from !== to;
        }}
        className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 shadow-lg"
      >
        {iconBtn("改写", () => void run("edit"), busy === "edit" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />, busy === "edit")}
        {iconBtn("续写", () => void run("continue"), busy === "continue" ? <LoaderCircle className="size-3.5 animate-spin" /> : <TextCursorInput className="size-3.5" />, busy === "continue")}
        {iconBtn(
          "审核",
          () => void run("review"),
          busy === "review-selection" || busy === "review-document" ? <LoaderCircle className="size-3.5 animate-spin" /> : <ListChecks className="size-3.5" />,
          busy === "review-selection" || busy === "review-document",
        )}
        {iconBtn(
          "格式化",
          () => void run("format"),
          busy === "format-selection" || busy === "format-document" ? <LoaderCircle className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />,
          busy === "format-selection" || busy === "format-document",
        )}
        {iconBtn("主题配图", () => void run("image"), busy === "image" ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />, busy === "image")}
      </BubbleMenu>
      {error ? (
        <div className="pointer-events-none absolute right-4 top-3 z-40 rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white">
          {error}
        </div>
      ) : null}
      {draft ? (
        <div
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
          style={cardStyle(editor, draft.range.to)}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <p className="mb-1.5 text-[11px] font-medium text-slate-500">
            {draft.kind === "edit"
              ? draft.whole
                ? "全文改写稿"
                : "改写稿"
              : draft.kind === "continue"
                ? draft.whole
                  ? "全文后续写"
                  : "续写稿"
                : draft.kind === "format-selection"
                  ? "格式化稿"
                  : "审核意见"}
            <span className="ml-1 font-normal text-slate-400">可改几个词再接受</span>
          </p>
          {draft.kind === "review" ? (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{draft.text}</pre>
          ) : (
            <textarea
              value={draft.text}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              rows={Math.min(12, Math.max(4, draft.text.split("\n").length + 1))}
              className="max-h-56 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-slate-300"
            />
          )}
          <div className="mt-2 flex gap-1.5">
            {draft.kind !== "review" ? (
              <button type="button" className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800" onClick={accept}>
                接受
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              onClick={() => setDraft(null)}
            >
              {draft.kind === "review" ? "关闭" : "不用"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
