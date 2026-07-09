import { useCallback, useRef, useState } from "react";
import { useApp } from "@/contexts";
import {
  createAgentRuntime,
  ProviderUnavailableError,
  type AgentRuntime,
} from "@/lib/agent";
import { useSkillStore, useMcpStore } from "@/store";
import { logUnifiedCall } from "@/lib/unified-api";
import type { AgentDefinition } from "@/types";

export interface AgentToolCallView {
  toolCallId: string;
  toolName: string;
  args: unknown;
  resultText?: string;
  isError?: boolean;
  done: boolean;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Tool calls made during an assistant turn. */
  tools?: AgentToolCallView[];
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Drive a single agent chat session. Resolves the provider connection from the
 * app's currently-selected AI provider and streams assistant + tool events into
 * a message transcript.
 */
export const useAgentRuntime = (agent: AgentDefinition | null) => {
  const { selectedAIProvider } = useApp();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtimeRef = useRef<AgentRuntime | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    runtimeRef.current?.abort();
    runtimeRef.current = null;
    assistantIdRef.current = null;
    setMessages([]);
    setError(null);
    setIsRunning(false);
  }, []);

  const upsertAssistant = useCallback(
    (updater: (prev: AgentChatMessage) => AgentChatMessage) => {
      const id = assistantIdRef.current;
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? updater(m) : m))
      );
    },
    []
  );

  const send = useCallback(
    async (input: string) => {
      if (!agent) {
        setError("请先选择一个 Agent");
        return;
      }
      if (!input.trim() || isRunning) return;
      setError(null);

      const userMsg: AgentChatMessage = {
        id: makeId(),
        role: "user",
        text: input,
      };
      setMessages((prev) => [...prev, userMsg]);

      const startedAt = Date.now();
      const reportCall = (status: number, error?: string) => {
        void logUnifiedCall({
          exposedModel: `${agent.providerId}/${agent.modelId}`,
          realModel: agent.modelId,
          provider: agent.providerId,
          protocol: "agent",
          stream: true,
          status,
          durationMs: Date.now() - startedAt,
          error,
        }).catch(() => {});
      };

      try {
        // Build a fresh runtime per turn so tool/skill/MCP edits take effect.
        const runtime = await createAgentRuntime(
          agent,
          {
            onAssistantStart: () => {
              const id = makeId();
              assistantIdRef.current = id;
              setMessages((prev) => [
                ...prev,
                { id, role: "assistant", text: "", tools: [] },
              ]);
            },
            onAssistantDelta: (text) => {
              upsertAssistant((prev) => ({ ...prev, text }));
            },
            onAssistantEnd: (text) => {
              upsertAssistant((prev) => ({ ...prev, text }));
            },
            onToolStart: (info) => {
              upsertAssistant((prev) => ({
                ...prev,
                tools: [
                  ...(prev.tools ?? []),
                  {
                    toolCallId: info.toolCallId,
                    toolName: info.toolName,
                    args: info.args,
                    done: false,
                  },
                ],
              }));
            },
            onToolEnd: (info) => {
              upsertAssistant((prev) => ({
                ...prev,
                tools: (prev.tools ?? []).map((t) =>
                  t.toolCallId === info.toolCallId
                    ? {
                        ...t,
                        resultText: info.resultText,
                        isError: info.isError,
                        done: true,
                      }
                    : t
                ),
              }));
            },
            onError: (message) => {
              setError(message);
            },
            onDone: () => {
              setIsRunning(false);
              reportCall(200);
            },
          },
          {
            skills: useSkillStore.getState().items,
            mcpServers: useMcpStore.getState().items,
            providerVariables: selectedAIProvider.variables,
          }
        );
        runtimeRef.current = runtime;
        setIsRunning(true);
        await runtime.prompt(input);
        await runtime.waitForIdle();
      } catch (err) {
        if (err instanceof ProviderUnavailableError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
        reportCall(500, err instanceof Error ? err.message : String(err));
      } finally {
        setIsRunning(false);
      }
    },
    [agent, isRunning, selectedAIProvider.variables, upsertAssistant]
  );

  const abort = useCallback(() => {
    runtimeRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { messages, isRunning, error, send, abort, reset };
};
