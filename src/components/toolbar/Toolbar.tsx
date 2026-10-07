/**
 * Main overlay toolbar — the primary UI of niuma-app.
 *
 * Layout (left → center → right):
 *   [Mic] [Speak] [Screenshot] [Chat] | [Input] | [Dashboard] [Close]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Loader2,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { ToolbarButton } from "./ToolbarButton";
import { DragButton, WingIcon } from "@/components";
import { UseTTSReturn } from "@/hooks/useTTS";
import { useApp } from "@/store";
import type { UseCompletionReturn } from "@/types";
import { Input } from "@/pages/app/components/completion/Input";
import {
  AutoSpeechVADHeadless,
  type AutoSpeechVADState,
} from "@/pages/app/components/completion/AutoSpeechVad";
import { MAX_FILES } from "@/config";
import { useQuickSearch } from "@/hooks/useQuickSearch";
import { QuickSearchPanel } from "./QuickSearchPanel";
import { usePomodoroTimer, type PomodoroRound } from "@/hooks/usePomodoroTimer";

// Toolbar strip height in logical pixels (matches tauri.conf.json initial height)

const POMODORO_COLORS: Record<PomodoroRound, string> = {
  work:          "#ef4444",
  "short-break": "#10b981",
  "long-break":  "#3b82f6",
  off:           "#6b7280",
};
const POMODORO_LABELS: Record<PomodoroRound, string> = {
  work:          "专注",
  "short-break": "短休息",
  "long-break":  "长休息",
  off:           "",
};

interface ToolbarProps {
  completion: UseCompletionReturn;
  tts: UseTTSReturn;
  isHidden: boolean;
}

export function Toolbar({ completion, tts, isHidden }: ToolbarProps) {
  const { selectedAudioDevices, sttLanguage } = useApp();
  const qs = useQuickSearch(completion.streamOnce);
  const pomodoro = usePomodoroTimer();

  // ── Pomodoro keyboard shortcuts (Alt+1/2/3 switch mode, Alt+Space pause, Alt+0 stop) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "1") { e.preventDefault(); pomodoro.startTimer("work"); }
      else if (e.key === "2") { e.preventDefault(); pomodoro.startTimer("short-break"); }
      else if (e.key === "3") { e.preventDefault(); pomodoro.startTimer("long-break"); }
      else if (e.key === " ") {
        e.preventDefault();
        if (!pomodoro.timerStarted) pomodoro.startTimer("work");
        else if (pomodoro.isRunning) pomodoro.pauseTimer();
        else pomodoro.resumeTimer();
      } else if (e.key === "0") { e.preventDefault(); pomodoro.stopTimer(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoro.timerStarted, pomodoro.isRunning]);

  // Resize window when quick-search panel opens / closes.
  useEffect(() => {
    if (qs.isOpen) {
      document.body.dataset.quickSearchOpen = "true";
      const win = getCurrentWebviewWindow();
      invoke("set_window_height", { window: win, height: 500 }).catch(() => {});
    } else {
      delete document.body.dataset.quickSearchOpen;
      const win = getCurrentWebviewWindow();
      invoke("set_window_height", { window: win, height: 54 }).catch(() => {});
    }
  }, [qs.isOpen]);

  // Real VAD capture state, reported by the headless controller mounted
  // below whenever completion.enableVAD is true. Drives the existing
  // mic ToolbarButton UI without changing its markup/styling.
  const [vadState, setVadState] = useState<AutoSpeechVADState>({
    listening: false,
    userSpeaking: false,
    isTranscribing: false,
    start: () => {},
    pause: () => {},
  });

  // Auto-speak the AI response via TTS once it finishes streaming, when enabled.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (
      wasLoadingRef.current &&
      !completion.isLoading &&
      tts.isEnabled &&
      completion.response
    ) {
      tts.speak(completion.response);
    }
    wasLoadingRef.current = completion.isLoading;
  }, [completion.isLoading, completion.response, tts.isEnabled, tts]);

  /**
   * Intercept the toolbar Enter key:
   * - empty input     → open agent-chat window
   * - slash commands  → route to agent-chat via sendToMainChat
   * - anything else   → trigger inline quick-search panel
   */
  const handleQuickSearchKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      if (completion.isSlashMenuOpen) return; // let handleInputKeyDown manage it

      const text = completion.input.trim();

      // Empty Enter → open agent-chat.
      if (!text) {
        e.preventDefault();
        void completion.sendToMainChat("");
        return;
      }

      // Slash commands still go to agent-chat.
      if (text.startsWith("/")) {
        completion.handleKeyPress(e);
        return;
      }

      // Plain text: gather local excerpts and web links, then summarize with zero-web AI.
      e.preventDefault();
      completion.setInput("");
      void qs.runSearch(text);
    },
    [completion, qs]
  );

  const handleOpenDashboard = useCallback(async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {
      window.close();
    }
  }, []);

  return (
    <div
      className="relative w-full flex flex-row items-center gap-2 rounded-2xl border border-[#e9e9e9] p-2 text-[#1a1a1a] bg-white/92 shadow-sm shadow-black/8 backdrop-blur-md overflow-visible"
      data-tauri-drag-region
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Drag handle strip at top */}
      <div
        className="absolute inset-x-0 top-0 h-3 z-0"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        aria-hidden="true"
      />

      {/* ── Left button group ── */}
      <div
        className="relative z-10 flex items-center gap-1 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Mic / recording — headless controller runs real VAD capture; no UI of its own */}
        {completion.enableVAD && (
          <AutoSpeechVADHeadless
            key={selectedAudioDevices.input}
            sendToMainChat={completion.sendToMainChat}
            setState={completion.setState}
            microphoneDeviceId={selectedAudioDevices.input}
            sttLanguage={sttLanguage}
            onStateChange={setVadState}
          />
        )}
        <ToolbarButton
          active={vadState.listening}
          activeColor="red"
          indicator={vadState.listening}
          indicatorColor="bg-red-500"
          title={vadState.listening ? "Stop recording" : "Start recording"}
          aria-label="Toggle microphone"
          onClick={() => {
            if (vadState.listening) {
              vadState.pause();
              setVadState((s) => ({ ...s, listening: false, userSpeaking: false, isTranscribing: false }));
              completion.setEnableVAD(false);
            } else {
              completion.setEnableVAD(true);
            }
          }}
        >
          {vadState.listening ? (
            <MicOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Mic className="h-4 w-4" aria-hidden="true" />
          )}
        </ToolbarButton>

        {/* SPEAK / TTS */}
        <ToolbarButton
          active={tts.isEnabled}
          activeColor="blue"
          indicator={tts.isSpeaking}
          indicatorColor="bg-blue-500"
          title={tts.isEnabled ? "Disable text-to-speech" : "Enable text-to-speech"}
          aria-label="Toggle text-to-speech"
          onClick={tts.toggle}
        >
          {tts.isEnabled ? (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          )}
        </ToolbarButton>

        {/* Screenshot / capture — Camera icon with full mode support */}
        <ToolbarButton
          title={`${completion.screenshotConfiguration?.enabled ? "Screenshot" : "Selection"} mode (${completion.screenshotConfiguration?.mode}) - ${completion.attachedFiles.length} files`}
          aria-label="Capture screenshot"
          disabled={completion.attachedFiles.length >= MAX_FILES || completion.isLoading || completion.isScreenshotLoading}
          onClick={completion.captureScreenshot}
        >
          {completion.isScreenshotLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="h-4 w-4" aria-hidden="true" />
          )}
        </ToolbarButton>
      </div>

      {/* ── Center: text input with optional pomodoro overlay ── */}
      <div
        className="relative z-10 flex-1 flex items-center gap-2 min-w-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="relative flex-1">
          <Input
            {...completion}
            handleKeyPress={handleQuickSearchKeyPress}
            isHidden={isHidden}
          />
          {/* Pomodoro timer — sits inside the input on the right */}
          {pomodoro.timerStarted && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 select-none">
              <span
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white leading-none"
                style={{ background: POMODORO_COLORS[pomodoro.currentRound] }}
              >
                <span className="opacity-80 text-[9px]">{POMODORO_LABELS[pomodoro.currentRound]}</span>
                <span>{pomodoro.formattedTime}</span>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (pomodoro.isRunning) pomodoro.pauseTimer();
                    else pomodoro.resumeTimer();
                  }}
                  className="opacity-75 hover:opacity-100 ml-0.5"
                  title={pomodoro.isRunning ? "暂停 (Alt+Space)" : "继续 (Alt+Space)"}
                >
                  {pomodoro.isRunning ? "⏸" : "▶"}
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); pomodoro.stopTimer(); }}
                  className="opacity-60 hover:opacity-100"
                  title="停止 (Alt+0)"
                >
                  ✕
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right button group ── */}
      <div
        className="relative z-10 flex items-center gap-1 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Dashboard */}
        <ToolbarButton
          title="Open dashboard"
          aria-label="Open dashboard"
          onClick={handleOpenDashboard}
        >
          <WingIcon className="h-5 w-5" />
        </ToolbarButton>

        {/* Close / hide */}
        <ToolbarButton
          title="Hide window"
          aria-label="Hide window"
          onClick={handleClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {/* Drag handle */}
        <DragButton />
      </div>

      {/* ── Quick-search panel (expands below toolbar pill) ── */}
      <QuickSearchPanel
        isOpen={qs.isOpen}
        query={qs.query}
        localResults={qs.localResults}
        imaResults={qs.imaResults}
        imaHint={qs.imaHint}
        aiSummary={qs.aiSummary}
        status={qs.status}
        error={qs.error}
        onClose={qs.close}
      />
    </div>
  );
}
