/**
 * Main overlay toolbar — the primary UI of niuma-app.
 *
 * Layout (left → center → right):
 *   [Mic] [Speak] [Screenshot] [Chat] [Meeting] [Timer] | [Input] | [Settings] [Close]
 *
 * Modelled after niuma Vue Main.vue for visual consistency.
 */
import { useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  MessageSquare,
  Users,
  X,
  LayoutDashboard,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { ToolbarButton } from "./ToolbarButton";
import { TimerButton } from "./TimerButton";
import { UseTimerReturn } from "@/hooks/useTimer";
import { UseTTSReturn } from "@/hooks/useTTS";
import type { UseCompletionReturn } from "@/types";
import { Input } from "@/pages/app/components/completion/Input";
import { Screenshot } from "@/pages/app/components/completion/Screenshot";
import { Files } from "@/pages/app/components/completion/Files";
import { UseQuickActionsReturn } from "@/hooks/useQuickActions";

interface ToolbarProps {
  completion: UseCompletionReturn;
  timer: UseTimerReturn;
  tts: UseTTSReturn;
  quickActions?: UseQuickActionsReturn;
  isHidden: boolean;
}

export function Toolbar({ completion, timer, tts, quickActions, isHidden }: ToolbarProps) {
  const [chatOpen, setChatOpen] = useState(false);

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {
      // fallback for browser/non-Tauri
      window.close();
    }
  };

  const handleOpenDashboard = async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

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

        {/* Screenshot */}
        <ToolbarButton
          title="Take screenshot"
          aria-label="Take screenshot"
          disabled={completion.isScreenshotLoading}
          onClick={completion.captureScreenshot}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {/* Chat / conversation toggle */}
        <ToolbarButton
          active={chatOpen}
          activeColor="blue"
          title="Toggle chat panel"
          aria-label="Toggle chat panel"
          onClick={() => setChatOpen((v) => !v)}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {/* Meeting mode */}
        <ToolbarButton
          active={completion.meetingAssistMode}
          activeColor="green"
          title={completion.meetingAssistMode ? "Stop meeting mode" : "Start meeting mode"}
          aria-label="Toggle meeting mode"
          onClick={() => completion.setMeetingAssistMode(!completion.meetingAssistMode)}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {/* Timer */}
        <TimerButton timer={timer} />
      </div>

      {/* ── Center: text input ── */}
      <div
        className="relative z-10 flex-1 flex items-center gap-2 min-w-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Input
          {...completion}
          isHidden={isHidden}
          quickActions={quickActions}
          onQuickActionClick={handleQuickAction}
        />
        <Screenshot {...completion} />
        <Files {...completion} />
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
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {/* Close / hide */}
        <ToolbarButton
          title="Hide window"
          aria-label="Hide window"
          onClick={handleClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      </div>
    </div>
  );
}
