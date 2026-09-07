import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import ChatPage from "./chat";
import ArticlesPage from "./articles";
import { subscribeOpenWorkbenchArticle } from "@/lib/artifact/open-workbench-article";

type WorkbenchView = "chat" | "editor";

export default function AgentChatPage() {
  const [activeView, setActiveView] = useState<WorkbenchView>("chat");
  const [openFilePath, setOpenFilePath] = useState<string | undefined>();

  useEffect(() => {
    document.title = "Niuma · 浮动工作台";
  }, []);

  useEffect(() => subscribeOpenWorkbenchArticle((detail) => {
    if (detail.switchView) setActiveView("editor");
  }), []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await invoke("toggle_agent_chat_maximize");
    } catch (error) {
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
        <ChatPage
          activeView={activeView}
          openFilePath={openFilePath}
          onViewChange={setActiveView}
          onExternalActivate={() => setActiveView("chat")}
          onOpenEditor={() => setActiveView("editor")}
          onToggleMaximize={handleToggleMaximize}
          onClose={handleClose}
        >
          <ArticlesPage
            activeView={activeView}
            onOpenFileChange={setOpenFilePath}
          />
        </ChatPage>
      </div>
    </div>
  );
}
