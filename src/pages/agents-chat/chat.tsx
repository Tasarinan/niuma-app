import { MessageSquare, Trash2, Sparkles } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";
import type { StudioMessage, AgentDefinition, Artifact } from "@/types";
import {
  RolePicker,
  ChatThread,
  StudioComposer,
  ArtifactPanel,
  StudioAvatar,
} from "./components";

export interface ChatSectionProps {
  ready: boolean;
  roles: AgentDefinition[];
  messages: StudioMessage[];
  isSending: boolean;
  streamingIds: Set<string>;
  agents: AgentDefinition[];
  artifacts: Artifact[];
  generatingArtifactId: string | null;
  liveContent: string;
  tts: ReturnType<typeof useTTS>;
  activeIds: string[];
  onAddRole: (id: string) => void;
  onRemoveRole: (id: string) => void;
  onClear: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onConfirmPlan: (msg: StudioMessage) => void;
  onRegenerate: (id: string, instruction: string) => void;
  onUpdate: (id: string, patch: Partial<Artifact>) => void;
  onRemoveArtifact: (id: string) => void;
}

export default function ChatSection({
  roles,
  messages,
  isSending,
  streamingIds,
  agents,
  artifacts,
  generatingArtifactId,
  liveContent,
  tts,
  activeIds,
  onAddRole,
  onRemoveRole,
  onClear,
  onSend,
  onStop,
  onConfirmPlan,
  onRegenerate,
  onUpdate,
  onRemoveArtifact,
}: ChatSectionProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/8 px-4 py-2.5">
          <MessageSquare className="size-4 text-purple-400" />
          <span className="text-sm font-semibold tracking-wide text-white/90">Chat</span>
          <span className="text-[10px] text-white/30">{roles.length} agents</span>
          <div className="ml-3 flex items-center -space-x-1.5">
            {roles.map((r) => (
              <button
                key={r.id}
                title={`Remove ${r.name}`}
                onClick={() => onRemoveRole(r.id)}
                className="transition-transform hover:z-10 hover:-translate-y-0.5"
              >
                <StudioAvatar
                  avatar={r.avatar}
                  name={r.name}
                  className="size-7 border-2 border-[#16171a] text-sm"
                />
              </button>
            ))}
            <div className="pl-2">
              <RolePicker
                agents={agents}
                selectedIds={activeIds}
                onAdd={onAddRole}
                onRemove={onRemoveRole}
              />
            </div>
          </div>
          <button
            onClick={onClear}
            title="Clear thread"
            className="ml-auto flex size-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/8 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {roles.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/10">
              <Sparkles className="size-7 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-white/50">Ready to collaborate</p>
            <p className="text-xs">Add agents from the Agents tab, then start chatting</p>
          </div>
        ) : (
          <ChatThread
            messages={messages}
            streamingIds={streamingIds}
            onConfirmPlan={onConfirmPlan}
            isBusy={isSending}
          />
        )}

        <StudioComposer
          disabled={roles.length === 0}
          isSending={isSending}
          ttsEnabled={tts.isEnabled}
          onToggleTts={tts.toggle}
          onSend={onSend}
          onStop={onStop}
        />
      </div>

      {/* Artifact panel */}
      <div className="w-[280px] flex-shrink-0 border-l border-white/8">
        <ArtifactPanel
          artifacts={artifacts}
          generatingArtifactId={generatingArtifactId}
          liveContent={liveContent}
          isSending={isSending}
          onUpdate={onUpdate}
          onRemove={onRemoveArtifact}
          onRegenerate={onRegenerate}
        />
      </div>
    </div>
  );
}
