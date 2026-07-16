import { useState, useCallback, useRef } from "react";
import { useSkillStore, useMcpStore } from "@/store";
import { useAgents } from "./useAgents";
import { createAgentRuntime } from "@/lib/agent";
import { getActiveProvider } from "@/lib/providers/storage";
import type { Message } from "@/types";
import type { AgentDefinition, GroupChannel, GroupMessage } from "@/types";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
  loadChannels,
  createChannel as storageCreateChannel,
  updateChannel as storageUpdateChannel,
  deleteChannel as storageDeleteChannel,
  loadMessages,
  saveMessages,
  appendMessage,
  clearMessages,
} from "@/lib/storage/group-chat.storage";

// ─── Helper: build LLM history for one agent ─────────────────────────────────

function buildHistory(
  msgs: GroupMessage[],
  agentId: string
): Message[] {
  return msgs.map((m): Message => {
    if (m.role === "user") {
      return { role: "user", content: m.content };
    }
    // Other agents' messages → user turn prefixed with their name
    if (m.agentId !== agentId) {
      return { role: "user", content: `[${m.agentName ?? "Agent"}]: ${m.content}` };
    }
    // This agent's own previous messages → assistant turn
    return { role: "assistant", content: m.content };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGroupChat() {
  const { agents } = useAgents();

  const [channels, setChannels] = useState<GroupChannel[]>(() => loadChannels());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const all = loadChannels();
    return all[0]?.id ?? null;
  });
  const [messages, setMessages] = useState<GroupMessage[]>(() => {
    const all = loadChannels();
    const first = all[0];
    return first ? loadMessages(first.id) : [];
  });
  const [isSending, setIsSending] = useState(false);
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // ─── Channel ops ───────────────────────────────────────────────────────────

  const selectChannel = useCallback((id: string) => {
    setSelectedId(id);
    setMessages(loadMessages(id));
  }, []);

  const createChannel = useCallback(
    (name: string, agentIds: string[], avatar?: string, kind?: GroupChannel["kind"]) => {
      const channel = storageCreateChannel(name, agentIds, avatar, kind);
      setChannels(loadChannels());
      setSelectedId(channel.id);
      setMessages([]);
      return channel;
    },
    []
  );

  const editChannel = useCallback(
    (id: string, patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind">>) => {
      storageUpdateChannel(id, patch);
      const updated = loadChannels();
      setChannels(updated);
    },
    []
  );

  const removeChannel = useCallback(
    (id: string) => {
      storageDeleteChannel(id);
      const remaining = loadChannels();
      setChannels(remaining);
      if (selectedId === id) {
        const next = remaining[0] ?? null;
        setSelectedId(next?.id ?? null);
        setMessages(next ? loadMessages(next.id) : []);
      }
    },
    [selectedId]
  );

  const clearChannelMessages = useCallback(
    (id: string) => {
      clearMessages(id);
      if (selectedId === id) setMessages([]);
    },
    [selectedId]
  );

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, images?: ImageContent[]) => {
      if (!selectedId || !content.trim() || isSending) return;

      const channel = channels.find((c) => c.id === selectedId);
      if (!channel) return;

      // Add user message
      const userMsg: GroupMessage = {
        id: crypto.randomUUID(),
        channelId: selectedId,
        role: "user",
        content: content.trim(),
        images: images?.length
          ? images.map((img) => ({ mimeType: img.mimeType, data: img.data }))
          : undefined,
        timestamp: new Date().toISOString(),
      };
      const msgsAfterUser = [...messages, userMsg];
      appendMessage(userMsg);
      setMessages(msgsAfterUser);

      setIsSending(true);
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      // Determine which agents to respond (all members, or @mentioned)
      const mentionRegex = /@(\S+)/g;
      const mentions: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(content)) !== null) mentions.push(m[1].toLowerCase());

      const respondingAgents = channel.agentIds
        .map((id) => agents.find((a) => a.id === id))
        .filter(Boolean)
        .filter((agent) => {
          if (mentions.length === 0) return true;
          return mentions.some((mn) => agent!.name.toLowerCase().includes(mn));
        });

      // Call each agent sequentially
      let currentMsgs = msgsAfterUser;
      for (const agent of respondingAgents) {
        if (signal.aborted) break;
        if (!agent) continue;

        // Placeholder streaming message
        const placeholderId = crypto.randomUUID();
        const placeholder: GroupMessage = {
          id: placeholderId,
          channelId: selectedId,
          role: "agent",
          agentId: agent.id,
          agentName: agent.name,
          agentAvatar: agent.avatar,
          content: "",
          timestamp: new Date().toISOString(),
        };
        currentMsgs = [...currentMsgs, placeholder];
        setMessages([...currentMsgs]);
        setStreamingIds((s) => new Set(s).add(placeholderId));

        const history = buildHistory(currentMsgs.slice(0, -1), agent.id);

        // Resolve provider for this agent: prefer the agent's own providerId,
        // fall back to the globally active provider (registry-based system).
        const activeProvider = getActiveProvider();
        const agentProviderId = agent.providerId || activeProvider?.providerId || "";
        const agentModelId = agent.modelId || activeProvider?.model || "";

        // Group context appended to agent's own system prompt
        const otherMembers = respondingAgents
          .filter((a) => a?.id !== agent.id)
          .map((a) => `${a?.name} (${a?.role ?? "AI"})`)
          .join(", ");
        const groupCtx = otherMembers
          ? `\n\nYou are in a group chat channel named "${channel.name}". Other participants: ${otherMembers}. Respond as ${agent.name} (${agent.role ?? "AI assistant"}). Be concise and in-character.`
          : `\n\nYou are in a channel named "${channel.name}". Respond as ${agent.name}.`;

        const transcript = history
          .map((h) => (h.role === "assistant" ? `${agent.name}: ${h.content}` : h.content))
          .join("\n");
        const historyBlock = transcript ? `\n\nConversation history:\n${transcript}` : "";

        const runtimeDef: AgentDefinition = {
          ...agent,
          providerId: agentProviderId,
          modelId: agentModelId,
          systemPrompt: (agent.systemPrompt ?? "") + groupCtx + historyBlock,
        };

        let fullContent = "";
        let runtimeError: string | null = null;
        try {
          if (!agentProviderId) {
            throw new Error(
              "No AI provider configured. Please configure one in Settings → AI Providers."
            );
          }
          const runtime = await createAgentRuntime(
            runtimeDef,
            {
              onAssistantDelta: (text) => {
                if (signal.aborted) return;
                fullContent = text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === placeholderId ? { ...msg, content: fullContent } : msg
                  )
                );
              },
              onAssistantEnd: (text) => {
                fullContent = text;
              },
              onError: (message) => {
                runtimeError = message;
              },
            },
            {
              skills: useSkillStore.getState().items,
              mcpServers: useMcpStore.getState().items,
              providerVariables: {},
            }
          );

          const onAbort = () => runtime.abort();
          signal.addEventListener("abort", onAbort, { once: true });
          try {
            await runtime.prompt(content.trim(), images);
            await runtime.waitForIdle();
          } finally {
            signal.removeEventListener("abort", onAbort);
          }
          if (runtimeError) throw new Error(runtimeError);
        } catch (err) {
          fullContent = `[Error: ${err instanceof Error ? err.message : String(err)}]`;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId ? { ...msg, content: fullContent } : msg
            )
          );
        }

        // Persist final message
        const finalMsg: GroupMessage = { ...placeholder, content: fullContent };
        appendMessage(finalMsg);
        currentMsgs = currentMsgs.map((msg) =>
          msg.id === placeholderId ? finalMsg : msg
        );
        setStreamingIds((s) => {
          const next = new Set(s);
          next.delete(placeholderId);
          return next;
        });
      }

      // Persist final state
      saveMessages(selectedId, currentMsgs);
      setIsSending(false);
    },
    [selectedId, channels, messages, isSending, agents]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsSending(false);
    setStreamingIds(new Set());
  }, []);

  const selectedChannel = channels.find((c) => c.id === selectedId) ?? null;
  const selectedAgents = (selectedChannel?.agentIds ?? [])
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean) as typeof agents;

  return {
    channels,
    selectedId,
    selectedChannel,
    selectedAgents,
    messages,
    isSending,
    streamingIds,
    agents,
    selectChannel,
    createChannel,
    editChannel,
    removeChannel,
    clearChannelMessages,
    sendMessage,
    stopGeneration,
  };
}
