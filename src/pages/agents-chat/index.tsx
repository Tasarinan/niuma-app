import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import ChatPage from "./chat";
import ArticlesPage from "./articles";
import { cn } from "@/lib/utils";

type WorkbenchView = "chat" | "editor";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function AgentChatPage() {
  const [activeView, setActiveView] = useState<WorkbenchView>("chat");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    document.title = "Niuma · 浮动工作台";
  }, []);

  // Sync maximize state with the actual OS window state.
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    // Best-effort read of initial state (may not work on borderless Windows).
    void win.isMaximized().then(setIsMaximized).catch(() => {});

    // Keep in sync when native window controls change size (e.g. macOS green button).
    void win
      .onResized(async () => {
        try {
          const maximized = await win.isMaximized();
          setIsMaximized(maximized);
        } catch {}
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    // Flip immediately so the editor layout responds before the OS animation.
    setIsMaximized((prev) => !prev);
    try {
      await invoke("toggle_agent_chat_maximize");
    } catch (error) {
      // Revert on failure.
      setIsMaximized((prev) => !prev);
      console.error("Failed to toggle agent-chat window size:", error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await invoke("hide_agent_chat_window");
    } catch (error) {
      console.error("Failed to hide agent-chat window:", error);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f2f3f8]">
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#f2f3f8]">
          <div className={cn("h-full w-full", activeView === "chat" ? "flex" : "hidden")}>
            <ChatPage
              activeView={activeView}
              onViewChange={setActiveView}
              onExternalActivate={() => setActiveView("chat")}
              onOpenEditor={() => setActiveView("editor")}
              onToggleMaximize={handleToggleMaximize}
              onClose={handleClose}
            />
          </div>
          <div className={cn("relative h-full w-full", activeView === "editor" ? "flex" : "hidden")}>
            <ArticlesPage
              activeView={activeView}
              onViewChange={setActiveView}
              onToggleMaximize={handleToggleMaximize}
              onClose={handleClose}
              isMaximized={isMaximized}
            />
          </div>
      </div>
    </div>
  );
}
