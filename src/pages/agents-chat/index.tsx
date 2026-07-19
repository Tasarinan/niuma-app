import { MouseEvent, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Maximize2, X } from "lucide-react";

import AgentsPage from "./agents";
import ArticlesPage from "./articles";
import ChatPage from "./chat";
import SkillsPage from "./skills";
import ProvidersPage from "@/pages/providers";
import { Sidebar } from "./components/Sidebar";
import { PageContainer } from "./components/PageContainer";

export type Section = "chat" | "agents" | "skills" | "articles" | "settings";

export default function AgentChatPage() {
  const [section, setSection] = useState<Section>("chat");

  useEffect(() => {
    document.title = "Niuma · 智能会话空间";
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await invoke("hide_agent_chat_window");
    } catch (error) {
      console.error("Failed to hide agent-chat window:", error);
    }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await invoke("toggle_agent_chat_maximize");
    } catch (error) {
      console.error("Failed to toggle agent-chat window size:", error);
    }
  }, []);

  const stopWindowDrag = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white">
        <header
          className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5"
        >
          <div
            className="flex min-w-0 flex-1 items-center gap-3"
            data-tauri-drag-region
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <div className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-900 text-sm font-semibold text-white shadow-sm">
              N
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Niuma · 智能会话空间</p>
              <p className="truncate text-[11px] text-slate-500">
                Agents / Chat / Meetings in one floating workspace
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              type="button"
              onMouseDown={stopWindowDrag}
              onClick={handleToggleMaximize}
              title="放大 / 还原"
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              type="button"
              onMouseDown={stopWindowDrag}
              onClick={handleClose}
              title="关闭"
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar section={section} onSectionChange={setSection} />

          <div className="flex min-w-0 flex-1 overflow-hidden bg-[#f8fafc]">
            <PageContainer pageId="chat" current={section}>
              <ChatPage onExternalActivate={() => setSection("chat")} />
            </PageContainer>
            <PageContainer pageId="agents" current={section}>
              <AgentsPage />
            </PageContainer>
            <PageContainer pageId="skills" current={section}>
              <SkillsPage />
            </PageContainer>
            <PageContainer pageId="articles" current={section}>
              <ArticlesPage />
            </PageContainer>
            <PageContainer pageId="settings" current={section}>
              <ProvidersPage />
            </PageContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
