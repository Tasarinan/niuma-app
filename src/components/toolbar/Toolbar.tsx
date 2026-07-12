/**
 * Main overlay toolbar — the primary UI of niuma-app.
 *
 * Layout (left → center → right):
 *   [Mic] [Speak] [Screenshot] [Chat] [Meeting] | [Input] | [Dashboard] [Close]
 */
import { useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Loader2,
  Palette,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { ToolbarButton } from "./ToolbarButton";
import { DragButton, WingIcon } from "@/components";
import { UseTTSReturn } from "@/hooks/useTTS";
import type { UseCompletionReturn } from "@/types";
import { Input } from "@/pages/app/components/completion/Input";
import { Files } from "@/pages/app/components/completion/Files";
import { UseQuickActionsReturn } from "@/hooks/useQuickActions";
import { MAX_FILES } from "@/config";

// Toolbar strip height in logical pixels (matches tauri.conf.json initial height)

interface ToolbarProps {
  completion: UseCompletionReturn;
  tts: UseTTSReturn;
  quickActions?: UseQuickActionsReturn;
  isHidden: boolean;
}

export function Toolbar({ completion, tts, quickActions, isHidden }: ToolbarProps) {
  const handleOpenDashboard = useCallback(async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  }, []);

  const handleOpenStudio = useCallback(async () => {
    try {
      await invoke("open_agent_chat_window");
    } catch (error) {
      console.error("Failed to open AgentChat:", error);
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

  const handleQuickAction = (action: string) => {
    if (completion.meetingAssistMode) {
      completion.submitWithMeetingContext(action);
    } else {
      completion.submit(action);
    }
  };

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
        {/* Mic / recording */}
        <ToolbarButton
          active={completion.micOpen}
          activeColor="red"
          indicator={completion.micOpen}
          indicatorColor="bg-red-500"
          title={completion.micOpen ? "Stop recording" : "Start recording"}
          aria-label="Toggle microphone"
          onClick={() => completion.setMicOpen(!completion.micOpen)}
        >
          {completion.micOpen ? (
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

      {/* ── Center: text input ── */}
      <div
        className="relative z-10 flex-1 flex items-center gap-2 min-w-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Files {...completion} />
        <Input
          {...completion}
          isHidden={isHidden}
          quickActions={quickActions}
          onQuickActionClick={handleQuickAction}
        />
      </div>

      {/* ── Right button group ── */}
      <div
        className="relative z-10 flex items-center gap-1 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Cowork */}
        <ToolbarButton
          title="Cowork"
          aria-label="Open cowork"
          onClick={handleOpenStudio}
        >
          <Palette className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

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
    </div>
  );
}
