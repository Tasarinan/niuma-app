import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, FileText, MessageSquare, Settings, Zap } from "lucide-react";

import AgentsPage from "./agents";
import ArticlesPage from "./articles";
import ChatPage from "./chat";
import SkillsPage from "./skills";
import ProvidersPage from "@/pages/providers";

type Section = "chat" | "agents" | "skills" | "articles" | "settings";

/** Mirrors DeDeClaw PageContainer: all pages mounted, shown/hidden via display.
 *  Uses display:block so child pages fill the full width naturally and
 *  h-full / ScrollArea flex-1 resolve correctly.
 */
function PageContainer({
  pageId,
  current,
  children,
}: {
  pageId: Section;
  current: Section;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: pageId === current ? "block" : "none",
    flex: 1,
    height: "100%",
    overflow: "hidden",
  };
  return <div style={style}>{children}</div>;
}

export default function AgentChatPage() {
  const [section, setSection] = useState<Section>("chat");
  const { t } = useTranslation("pages");

  const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "chat",     label: t("agentsChat.tabs.chat"),     icon: MessageSquare },
    { id: "agents",   label: t("agentsChat.tabs.agents"),   icon: Brain },
    { id: "skills",   label: t("agentsChat.tabs.skills"),   icon: Zap },
    { id: "articles", label: t("agentsChat.tabs.articles"), icon: FileText },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* ── NavigationBar — mirrors DeDeClaw style ── */}
      <nav className="flex w-20 flex-shrink-0 flex-col items-center bg-[#2C2D33] pb-3 pt-6">
        {/* Nav items */}
        <div className="flex flex-col items-center gap-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                title={label}
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200",
                  isActive
                    ? "bg-[#3E3F47] text-white scale-105 shadow-sm"
                    : "text-gray-400 hover:bg-[#3E3F47] hover:text-gray-200",
                ].join(" ")}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </button>
            );
          })}
        </div>

        {/* Settings at bottom */}
        <div className="mt-auto">
          <button
            title={t("agentsChat.settingsTitle")}
            onClick={() => setSection((s) => s === "settings" ? "chat" : "settings")}
            className={[
              "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200",
              section === "settings"
                ? "bg-[#3E3F47] text-white scale-105 shadow-sm"
                : "text-gray-500 hover:bg-[#3E3F47] hover:text-gray-300",
            ].join(" ")}
          >
            <Settings size={22} strokeWidth={section === "settings" ? 2.5 : 2} />
          </button>
        </div>
      </nav>

      {/* ── Page content — DeDeClaw PageContainer pattern ── */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <PageContainer pageId="chat" current={section}>
          <ChatPage />
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
