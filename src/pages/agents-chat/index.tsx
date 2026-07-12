import { useState, useCallback, useEffect } from "react";
import { Brain, Users, Hash, MessageSquare, FileText, Zap } from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";
import type { StudioMessage } from "@/types";

import ChatSection from "./chat";
import AgentsPage from "./agents";
import SkillsPage from "./skills";
import GroupsPage from "./groups";
import ChannelsPage from "./channels";
import ArticlesPage from "./articles";

type Section = "skills" | "agents" | "groups" | "channels" | "chat" | "articles";

const NAV_ITEMS: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: "skills",   label: "Skills",   Icon: Zap },
  { id: "agents",   label: "Agents",   Icon: Brain },
  { id: "groups",   label: "Groups",   Icon: Users },
  { id: "channels", label: "Channels", Icon: Hash },
  { id: "chat",     label: "Chat",     Icon: MessageSquare },
  { id: "articles", label: "Articles", Icon: FileText },
];

export default function AgentChatPage() {
  const [section, setSection] = useState<Section>("chat");
  const tts = useTTS();
  const speakRef = useCallback((text: string) => tts.speak(text), [tts]);
  const studio = useStudio({ onAgentReply: speakRef });

  const {
    projects,
    selectedId,
    selectedProject,
    roles,
    messages,
    isSending,
    streamingIds,
    agents,
    artifacts,
    generatingArtifactId,
    liveContent,
    selectProject,
    createProject,
    addRole,
    removeRole,
    clearThread,
    send,
    stop,
    confirmPlan,
    regenerateArtifact,
    updateArtifact,
    removeArtifact,
  } = studio;

  useEffect(() => {
    if (projects.length === 0) {
      createProject("session", []);
    } else if (!selectedId && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [projects, selectedId, createProject, selectProject]);

  const handleConfirmPlan = useCallback(
    (msg: StudioMessage) => void confirmPlan(msg),
    [confirmPlan]
  );

  const activeIds = selectedProject?.agentIds ?? [];

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: "#16171a", color: "#e2e4e9" }}
    >
      {/* ── Left icon nav ── */}
      <nav
        className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1 py-4"
        style={{ background: "#0f1012" }}
      >
        <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-purple-600 shadow-lg shadow-purple-900/40">
          <span className="text-[10px] font-bold tracking-wide text-white">AC</span>
        </div>
        <div className="mb-1 w-8 border-b border-white/10" />
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            title={label}
            className={cn(
              "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200",
              section === id
                ? "bg-purple-500/25 text-purple-300"
                : "text-white/30 hover:bg-white/6 hover:text-white/70"
            )}
          >
            <Icon size={18} strokeWidth={section === id ? 2.5 : 2} />
            <span className="text-[8px] leading-none">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Section content ── */}
      <div
        className="flex min-w-0 flex-1 overflow-hidden"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {section === "skills" && (
          <div className="flex-1 overflow-auto bg-background">
            <SkillsPage />
          </div>
        )}
        {section === "agents" && (
          <div className="flex-1 overflow-auto bg-background">
            <AgentsPage />
          </div>
        )}
        {section === "groups" && (
          <div className="flex-1 overflow-auto bg-background">
            <GroupsPage />
          </div>
        )}
        {section === "channels" && (
          <div className="flex-1 overflow-auto bg-background">
            <ChannelsPage />
          </div>
        )}
        {section === "chat" && (
          <ChatSection
            ready={!!selectedProject}
            roles={roles}
            messages={messages}
            isSending={isSending}
            streamingIds={streamingIds}
            agents={agents}
            artifacts={artifacts}
            generatingArtifactId={generatingArtifactId}
            liveContent={liveContent}
            tts={tts}
            activeIds={activeIds}
            onAddRole={addRole}
            onRemoveRole={removeRole}
            onClear={clearThread}
            onSend={send}
            onStop={stop}
            onConfirmPlan={handleConfirmPlan}
            onRegenerate={regenerateArtifact}
            onUpdate={updateArtifact}
            onRemoveArtifact={removeArtifact}
          />
        )}
        {section === "articles" && (
          <div className="flex-1 overflow-auto bg-background">
            <ArticlesPage />
          </div>
        )}
      </div>
    </div>
  );
}
