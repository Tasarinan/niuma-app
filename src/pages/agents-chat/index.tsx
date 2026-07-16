import { useState } from "react";

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar section={section} onSectionChange={setSection} />

      <div className="flex min-w-0 flex-1 overflow-hidden">
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
  );
}
