/**
 * useMeetingAgents - drives real-time agent reactions during live transcription.
 *
 * After a configurable silence window following each new transcript chunk,
 * the next agent in rotation receives a brief prompt containing only the
 * new lines since the last reaction. Each agent responds in-character and
 * may invoke its enabled skills (meetpoints / meetactions / meetreply, etc.).
 *
 * Users can also send manual messages via sendManualMessage() to join the
 * discussion directly, which triggers responses from all channel agents.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentStore, useSkillStore, useMcpStore } from "@/store";
import { createAgentRuntime, bridgeEnabledNiumaSkills } from "@/lib/agent";
import { getActiveApiProvider, getActiveProvider } from "@/lib/providers/storage";
import { getProvider } from "@/lib/providers/registry";
import type { AgentDefinition, TranscriptEntry } from "@/types";

/** Milliseconds of transcript silence before agents react. */
const DEBOUNCE_MS = 4000;

/** Minimum word count of new lines before triggering a reaction. */
const MIN_WORDS = 8;

export interface AgentNote {
  id: string;
  source: "agent";
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  /** Role label shown as subtitle. */
  agentRole?: string;
  content: string;
  timestamp: number;
  isStreaming: boolean;
}

export interface UserNote {
  id: string;
  source: "user";
  content: string;
  timestamp: number;
}

export type WorkspaceEntry = AgentNote | UserNote;

export function useMeetingAgents({
  channelName,
  agentIds,
  transcript,
  isRecording,
}: {
  channelName: string;
  agentIds: string[];
  transcript: TranscriptEntry[];
  isRecording: boolean;
}) {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);

  const allAgents = useAgentStore((s) => s.items);
  const channelAgents = agentIds
    .map((id) => allAgents.find((a) => a.id === id))
    .filter(Boolean) as AgentDefinition[];

  const lastProcessedRef = useRef(0);
  const rotationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  // Stable refs so closures never go stale.
  const channelAgentsRef = useRef(channelAgents);
  channelAgentsRef.current = channelAgents;
  const channelNameRef = useRef(channelName);
  channelNameRef.current = channelName;

  /** Run a single agent turn and stream the result into `entries`. */
  const runAgent = useCallback(async (
    agent: AgentDefinition,
    prompt: string,
  ) => {
    const noteId = crypto.randomUUID();
    const agentNote: AgentNote = {
      id: noteId,
      source: "agent",
      agentId: agent.id,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      agentRole: agent.role ?? undefined,
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };
    setEntries((prev) => [...prev, agentNote]);

    try {
      const bridgedSkillIds = await bridgeEnabledNiumaSkills().catch(() => []);
      const activeProvider = getActiveApiProvider() ?? getActiveProvider();
      const agentProviderId = agent.providerId || activeProvider?.providerId || "";
      const agentModelId = agent.modelId || activeProvider?.model || "";

      // Web (zero-token) providers cannot be used with the PI agent runtime.
      const resolvedDef = getProvider(agentProviderId);
      if (resolvedDef?.type === "web" || !agentProviderId) {
        const errMsg = agentProviderId
          ? `[错误] 网页零Token提供商「${resolvedDef?.name}」不支持会议智能体。请在「设置 → AI 提供商」切换到 API 提供商。`
          : "[错误] 未配置 AI 提供商，请在「设置 → AI 提供商」中添加。";
        setEntries((prev) =>
          prev.map((n) => n.id === noteId ? { ...n, content: errMsg, isStreaming: false } as AgentNote : n)
        );
        return;
      }

      const runtimeDef: AgentDefinition = {
        ...agent,
        providerId: agentProviderId,
        modelId: agentModelId,
        enabledSkillIds: Array.from(
          new Set([...(agent.enabledSkillIds ?? []), ...bridgedSkillIds])
        ),
      };

      let fullContent = "";
      const runtime = await createAgentRuntime(
        runtimeDef,
        {
          onAssistantDelta: (text) => {
            fullContent = text;
            setEntries((prev) =>
              prev.map((n) => n.id === noteId ? { ...n, content: fullContent } as AgentNote : n)
            );
          },
          onAssistantEnd: (text) => {
            fullContent = text;
            setEntries((prev) =>
              prev.map((n) => n.id === noteId ? { ...n, content: text, isStreaming: false } as AgentNote : n)
            );
          },
          onToolStart: ({ toolName }) => {
            setEntries((prev) =>
              prev.map((n) =>
                n.id === noteId
                  ? { ...n, content: `[正在调用 ${toolName}…]\n${(n as AgentNote).content}` } as AgentNote
                  : n
              )
            );
          },
          onError: (msg) => {
            setEntries((prev) =>
              prev.map((n) => n.id === noteId ? { ...n, content: `[${msg}]`, isStreaming: false } as AgentNote : n)
            );
          },
        },
        {
          skills: useSkillStore.getState().items,
          mcpServers: useMcpStore.getState().items,
          providerVariables: {},
        }
      );
      await runtime.prompt(prompt);
      await runtime.waitForIdle();
    } catch (err) {
      setEntries((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, content: `[Error: ${err instanceof Error ? err.message : String(err)}]`, isStreaming: false } as AgentNote
            : n
        )
      );
    }
  }, []);

  const processSegment = useCallback(async (transcriptLines: TranscriptEntry[]) => {
    const agents = channelAgentsRef.current;
    if (busyRef.current || agents.length === 0) return;

    const lines = transcriptLines
      .map((e) => `${e.speaker?.speakerLabel ?? "Speaker"}: ${e.original}`)
      .join("\n");

    if (lines.trim().split(/\s+/).length < MIN_WORDS) return;

    const idx = rotationRef.current % agents.length;
    rotationRef.current += 1;
    const agent = agents[idx];

    busyRef.current = true;
    try {
      await runAgent(
        agent,
        `[会议频道: ${channelNameRef.current}]\n[实时转录片段]\n\n${lines}\n\n` +
        `请根据你的角色职责，对这段内容给出简短的实时反应（2-3句，中文）。如果你有相关的 skill 可以使用，请调用它。`,
      );
    } finally {
      busyRef.current = false;
    }
  }, [runAgent]);

  /** Send a manual message from the user; all agents respond in sequence. */
  const sendManualMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const agents = channelAgentsRef.current;
    if (agents.length === 0) return;

    // Append user bubble
    const userEntry: UserNote = {
      id: crypto.randomUUID(),
      source: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setEntries((prev) => [...prev, userEntry]);

    const prompt =
      `[会议频道: ${channelNameRef.current}]\n[用户加入讨论]\n\n${trimmed}\n\n` +
      `请根据你的角色职责，对用户的发言给出回应（2-4句，中文）。如有相关 skill 请调用。`;

    // All agents respond to manual user input, sequentially.
    for (const agent of agents) {
      await runAgent(agent, prompt);
    }
  }, [runAgent]);

  useEffect(() => {
    if (!isRecording) return;
    if (transcript.length <= lastProcessedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const newEntries = transcript.slice(lastProcessedRef.current);
      lastProcessedRef.current = transcript.length;
      void processSegment(newEntries);
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [transcript, isRecording, processSegment]);

  useEffect(() => {
    if (!isRecording) {
      lastProcessedRef.current = 0;
      rotationRef.current = 0;
    }
  }, [isRecording]);

  const clearNotes = useCallback(() => setEntries([]), []);

  // Backward-compat alias so consumers can still destructure `notes`.
  return { notes: entries, clearNotes, sendManualMessage };
}
