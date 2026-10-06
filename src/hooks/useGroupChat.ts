import { useState, useCallback, useRef } from "react";
import { useSkillStore, useMcpStore } from "@/store";
import { useAgents } from "./useAgents";
import { createAgentRuntime, bridgeEnabledNiumaSkills } from "@/lib/agent";
import { getActiveProvider, getActiveApiProvider } from "@/lib/providers/storage";
import { getResponseSettings } from "@/lib/storage/response-settings.storage";
import { getProvider } from "@/lib/providers/registry";
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
import { missingCommandAgentMessage, selectAgentsForCommand, shouldSmartDispatch } from "@/lib/agent/command-target";
import { getWorkbenchTeamPreset, loadWorkbenchTeamPresets } from "@/lib/agent/workbench-defaults";
import { mergeRuntimeInternalTools } from "@/lib/agent/runtime-internal-tools";
import { describeAgentToolProgress } from "@/lib/agent/tool-progress";
import { agentMatchesRole, resolveDefaultRole } from "@/lib/agent/team-manifest";
import { imageRoleNames } from "@/lib/content/roster-workflow";
import {
  formatContentDispatchInstruction,
  resolveContentRouteTarget,
} from "@/lib/content/role-ownership";
import { stripHiddenDraftContext } from "@/lib/artifact/draft-workspace";

// ─── Helper: build LLM history for one agent ─────────────────────────────────

function buildHistory(
  msgs: GroupMessage[],
  agentId: string
): Message[] {
  return msgs.map((m): Message => {
    if (m.role === "user") {
      return { role: "user", content: stripHiddenDraftContext(m.content) };
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
    (name: string, agentIds: string[], avatar?: string, kind?: GroupChannel["kind"], tags?: string[], teamId?: string) => {
      const channel = storageCreateChannel(name, agentIds, avatar, kind, tags, teamId);
      setChannels(loadChannels());
      setSelectedId(channel.id);
      setMessages([]);
      return channel;
    },
    []
  );

  const editChannel = useCallback(
    (id: string, patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags" | "teamId">>) => {
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
    async (content: string, images?: ImageContent[], channelIdOverride?: string, targetAgentNames?: string[], displayContent?: string) => {
      const targetId = channelIdOverride ?? selectedId;
      if (!targetId || !content.trim() || isSending) return;

      // Fall back to a fresh storage read in case the caller just created the
      // channel in this same tick (channels state may not have re-rendered yet).
      const channel =
        channels.find((c) => c.id === targetId) ??
        loadChannels().find((c) => c.id === targetId);
      if (!channel) return;

      // Add user message
      const userMsg: GroupMessage = {
        id: crypto.randomUUID(),
        channelId: targetId,
        role: "user",
        content: (displayContent ?? content).trim(),
        images: images?.length
          ? images.map((img) => ({ mimeType: img.mimeType, data: img.data }))
          : undefined,
        timestamp: new Date().toISOString(),
      };
      // If the target channel isn't the one currently loaded into `messages`
      // (e.g. we just created/switched to it in this same tick), read its
      // history fresh from storage instead of appending onto the wrong
      // channel's in-memory message list.
      const baseMessages = targetId === selectedId ? messages : loadMessages(targetId);
      const msgsAfterUser = [...baseMessages, userMsg];
      appendMessage(userMsg);
      setMessages(msgsAfterUser);

      setIsSending(true);
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      // Determine which agents to respond (all members, or @mentioned)
      const mentionSource = (displayContent ?? content);
      const mentionRegex = /@(\S+)/g;
      const mentions: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(mentionSource)) !== null) mentions.push(m[1].toLowerCase());

      const allChannelAgents = channel.agentIds
        .map((id) => agents.find((a) => a.id === id))
        .filter(Boolean) as AgentDefinition[];

      const workbenchPresets = await loadWorkbenchTeamPresets();
      const teamPreset = getWorkbenchTeamPreset(channel, workbenchPresets);
      const teamRoles = teamPreset?.roles ?? [];
      const producerRole = resolveDefaultRole(teamPreset ?? {});
      const producerName = producerRole?.name;
      const channelAgents = teamRoles.length > 0
        ? (() => {
            const producer = allChannelAgents.find((a) => agentMatchesRole(a, producerRole));
            return producer
              ? [producer, ...allChannelAgents.filter((a) => a.id !== producer.id)]
              : allChannelAgents;
          })()
        : allChannelAgents;
      const MAX_CONTENT_AGENT_RUNS = 4;

      const useSmartDispatch = shouldSmartDispatch({
        channelAgents: channelAgents,
        targetAgentNames,
        mentionCount: mentions.length,
      });

      const initialAgents: AgentDefinition[] = useSmartDispatch
        ? [channelAgents[0]]
        : channelAgents.filter((agent) => {
            if (targetAgentNames && targetAgentNames.length > 0) {
              return selectAgentsForCommand([agent], targetAgentNames).length > 0;
            }
            if (mentions.length === 0) return true;
            return mentions.some((mn) => agent.name.toLowerCase().includes(mn));
          });

      if (targetAgentNames && targetAgentNames.length > 0 && initialAgents.length === 0) {
        const miss: GroupMessage = {
          id: crypto.randomUUID(),
          channelId: targetId,
          role: "agent",
          agentName: targetAgentNames[0],
          content: missingCommandAgentMessage(targetAgentNames, teamPreset?.defaultCommand),
          timestamp: new Date().toISOString(),
        };
        const withMiss = [...msgsAfterUser, miss];
        appendMessage(miss);
        setMessages(withMiss);
        saveMessages(targetId, withMiss);
        setIsSending(false);
        return;
      }

      // Register file-based .niuma skills in the Skill store so load_skill
      // can resolve them. Keep each agent's own enabledSkillIds — dumping the
      // Role skills stay per-agent from config.yaml roles.
      if (initialAgents.length > 0) {
        await bridgeEnabledNiumaSkills().catch(() => []);
      }

      // Call agents sequentially; smart-dispatch may add routed agent after dispatcher runs
      const agentsToRun: AgentDefinition[] = [...initialAgents];
      let currentMsgs = msgsAfterUser;
      let agentRunIdx = 0;
      while (agentRunIdx < agentsToRun.length) {
        const agent = agentsToRun[agentRunIdx++];
        const isDispatcherTurn = useSmartDispatch && agentRunIdx === 1;
        if (signal.aborted) break;
        if (!agent) continue;

        // Placeholder streaming message
        const placeholderId = crypto.randomUUID();
        const placeholder: GroupMessage = {
          id: placeholderId,
          channelId: targetId,
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
        // fall back to the dedicated API provider (web/zero-token providers are
        // toolbar-only and cannot be used with the PI agent runtime).
        const activeProvider = getActiveApiProvider() ?? getActiveProvider();
        const agentProviderId = agent.providerId || activeProvider?.providerId || "";
        const agentModelId = agent.modelId || activeProvider?.model || "";

        // Zero-token (web) providers relay requests through a browser WebView
        // session and cannot be used with the PI agent runtime. Show a clear
        // error instead of silently hitting the website URL as an API endpoint.
        const resolvedDef = getProvider(agentProviderId);
        if (resolvedDef?.type === "web") {
          const errContent = `[错误] 网页零Token提供商「${resolvedDef.name}」不支持智能体对话。\n请在「设置 → AI 提供商」切换到 API 提供商（如 OpenAI、Anthropic、DeepSeek 等）。`;
          const errMsg: GroupMessage = { ...placeholder, content: errContent };
          appendMessage(errMsg);
          currentMsgs = currentMsgs.map((msg) => msg.id === placeholderId ? errMsg : msg);
          setMessages([...currentMsgs]);
          setStreamingIds((s) => { const next = new Set(s); next.delete(placeholderId); return next; });
          agentRunIdx = agentsToRun.length; // stop processing further agents
          continue;
        }

        // Group context appended to agent's own system prompt
        const otherMembers = channelAgents
          .filter((a) => a.id !== agent.id)
          .map((a) => `${a.name} (${a.role ?? "AI"})`)
          .join(", ");
        const groupCtx = otherMembers
          ? `\n\nYou are in a group chat channel named "${channel.name}". Other participants: ${otherMembers}. Respond as ${agent.name} (${agent.role ?? "AI assistant"}). Be concise and in-character.`
          : `\n\nYou are in a channel named "${channel.name}". Respond as ${agent.name}.`;

        // Smart-dispatch: default agent from config.yaml routes; specialists escalate back.
        const dispatchInstruction =
          useSmartDispatch && teamRoles.length > 0
            ? formatContentDispatchInstruction(agent.name, teamRoles, producerName)
            : isDispatcherTurn
              ? (() => {
                  const roster = channelAgents
                    .filter((a) => a.id !== agent.id)
                    .map((a) => `- ${a.name}：${a.role || "AI助手"}`)
                    .join("\n");
                  return `\n\n[团队协调] 职责表：\n${roster}\n\n请先用1-2句话接住问题，然后另起一行写：\nROUTE: @成员名称\n只 ROUTE 给职责表里拥有该技能或命令的角色。不要 load_skill 别人的技能，不要 bash 跑别人的脚本。你自己最合适时写 ROUTE: @${agent.name}。`;
                })()
              : "";

        const transcript = history
          .map((h) => (h.role === "assistant" ? `${agent.name}: ${h.content}` : h.content))
          .join("\n");
        const historyBlock = transcript ? `\n\nConversation history:\n${transcript}` : "";

        const runtimeDef: AgentDefinition = {
          ...agent,
          providerId: agentProviderId,
          modelId: agentModelId,
          // Apply the global response-length setting as fallback when the agent
          // has no explicit maxTokens set in its definition.
          maxTokens: agent.maxTokens ?? getResponseSettings().maxTokens,
          systemPrompt: (agent.systemPrompt ?? "") + groupCtx + historyBlock + dispatchInstruction,
          enabledSkillIds: agent.enabledSkillIds ?? [],
          // Image-family roles get generate_image / search_images so hired agents pick up the system
          // Provider image API without waiting for a catalog resync.
          enabledInternalTools: mergeRuntimeInternalTools(agent.enabledInternalTools ?? [], {
            bridgedSkillCount: (agent.enabledSkillIds ?? []).length,
            agentName: agent.name,
            agentRole: agent.role,
            imageRoleNames: imageRoleNames(teamRoles),
          }),
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
              onToolStart: (info) => {
                if (signal.aborted) return;
                const label = describeAgentToolProgress(info.toolName, info.args);
                if (!label) return;
                const step = {
                  toolCallId: info.toolCallId,
                  toolName: info.toolName,
                  label,
                  done: false,
                };
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== placeholderId) return msg;
                    const steps = msg.toolProgress ?? [];
                    const last = steps[steps.length - 1];
                    if (last?.label === label) {
                      return {
                        ...msg,
                        toolProgress: [
                          ...steps.slice(0, -1),
                          { ...last, toolCallId: info.toolCallId, done: false, isError: false },
                        ],
                      };
                    }
                    return { ...msg, toolProgress: [...steps, step] };
                  })
                );
              },
              onToolEnd: (info) => {
                if (signal.aborted) return;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === placeholderId
                      ? {
                          ...msg,
                          toolProgress: (msg.toolProgress ?? []).map((step) =>
                            step.toolCallId === info.toolCallId
                              ? { ...step, done: true, isError: info.isError }
                              : step
                          ),
                        }
                      : msg
                  )
                );
              },
              onError: (message) => {
                runtimeError = message;
              },
            },
            {
              skills: useSkillStore.getState().items,
              mcpServers: useMcpStore.getState().items,
              providerVariables: {},
              // Pass teamId so the agent gets shared team memory
              teamId: channel.teamId ?? undefined,
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

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId ? { ...msg, content: fullContent } : msg
          )
        );
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

        // Smart dispatch: parse first ROUTE line and queue one follow-up agent
        if (useSmartDispatch && !signal.aborted && agentsToRun.length < MAX_CONTENT_AGENT_RUNS) {
          const routeMatch = fullContent.match(/ROUTE:\s*@([^\s\n]+)/i);
          if (routeMatch) {
            let routedAgent: AgentDefinition | undefined;
            if (teamRoles.length > 0) {
              routedAgent = resolveContentRouteTarget(agent.name, routeMatch[1], channelAgents, producerName) ?? undefined;
            } else if (isDispatcherTurn) {
              const routedName = routeMatch[1].toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
              routedAgent = channelAgents
                .filter((a) => a.id !== agent.id)
                .find((a) => {
                  const n = a.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
                  return n.includes(routedName) || routedName.includes(n);
                });
            }
            if (
              routedAgent &&
              routedAgent.id !== agent.id &&
              !agentsToRun.some((queued) => queued.id === routedAgent.id)
            ) {
              agentsToRun.push(routedAgent);
            }
          }
        }
      }

      // Persist final state
      saveMessages(targetId, currentMsgs);
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
