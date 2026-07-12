/**
 * useStudio — orchestration for the local multi-agent collaborative creation
 * "Studio". One human collaborates with several AI roles to discuss, plan, and
 * co-author shared documents (artifacts).
 *
 * Every role runs through the Pi agent runtime (`createAgentRuntime`), so each
 * turn keeps full PI capabilities: skills, MCP tools, internal tools, and
 * streamed tool-call events. Agents take turns sequentially and can see the
 * running transcript, enabling genuine multi-party discussion — all local,
 * no backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp, useSkillStore, useMcpStore } from "@/store";
import { useAgents } from "./useAgents";
import { useArtifacts } from "./useArtifacts";
import { createAgentRuntime, type AgentRuntime } from "@/lib/agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import type {
  AgentDefinition,
  StudioProject,
  StudioMessage,
  StudioToolCall,
  StudioPlan,
  StudioAttachment,
} from "@/types";
import {
  loadProjects,
  createProject as storageCreateProject,
  updateProject as storageUpdateProject,
  deleteProject as storageDeleteProject,
  loadMessages,
  saveMessages,
  clearMessages,
} from "@/lib/storage/studio.storage";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_INSTRUCTION = `\n\n【计划模式】请基于上面的讨论，输出一个结构化的创作计划。只返回一个 JSON 代码块，不要输出其它文字，格式如下：\n\`\`\`json\n{"plans":[{"title":"文档/章节标题","summary":"一句话说明","prompt":"给写作者的详细写作指令"}]}\n\`\`\``;

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convert image attachments into Pi multimodal content. */
function toImages(atts?: StudioAttachment[]): ImageContent[] {
  return (atts ?? [])
    .filter((a) => a.kind === "image")
    .map((a) => ({
      type: "image",
      data: a.data,
      mimeType: a.mimeType,
    })) as ImageContent[];
}

/** Inline text-file attachments into the prompt body. */
function filesBlock(atts?: StudioAttachment[]): string {
  const files = (atts ?? []).filter((a) => a.kind === "file");
  if (!files.length) return "";
  return (
    "\n\n" +
    files.map((f) => `【附件：${f.name}】\n${f.data}`).join("\n\n")
  );
}

/** Build a readable transcript for the next agent to respond to. */
function buildTranscript(msgs: StudioMessage[]): string {
  return msgs
    .filter((m) => m.content.trim().length > 0)
    .map((m) => {
      const who = m.role === "user" ? "用户" : m.agentName ?? "助手";
      return `${who}：${m.content}`;
    })
    .join("\n\n");
}

/** Extract a structured plan from an agent's raw reply, if present. */
function parsePlan(text: string): { plan: StudioPlan; lead: string } | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      plans?: { title?: string; summary?: string; prompt?: string }[];
    };
    if (!Array.isArray(parsed.plans) || parsed.plans.length === 0) return null;
    const plans = parsed.plans.map((p) => ({
      title: String(p.title ?? "未命名"),
      summary: String(p.summary ?? ""),
      prompt: String(p.prompt ?? p.summary ?? p.title ?? ""),
    }));
    const lead = fence ? text.replace(fence[0], "").trim() : "";
    return { plan: { plans }, lead: lead || "我整理了一份创作计划，请确认：" };
  } catch {
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseStudioOptions {
  /** Called with an agent's final reply text (e.g. to speak via TTS). */
  onAgentReply?: (text: string) => void;
}

export interface SendOptions {
  attachments?: StudioAttachment[];
  planMode?: boolean;
}

export function useStudio(options: UseStudioOptions = {}) {
  const { selectedAIProvider } = useApp();
  const { agents } = useAgents();

  const [projects, setProjects] = useState<StudioProject[]>(() => loadProjects());
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadProjects()[0]?.id ?? null
  );
  const [messages, setMessages] = useState<StudioMessage[]>(() => {
    const first = loadProjects()[0];
    return first ? loadMessages(first.id) : [];
  });
  const [isSending, setIsSending] = useState(false);
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
  const [generatingArtifactId, setGeneratingArtifactId] = useState<string | null>(
    null
  );
  const [liveContent, setLiveContent] = useState("");

  const messagesRef = useRef<StudioMessage[]>(messages);
  const runtimeRef = useRef<AgentRuntime | null>(null);
  const abortedRef = useRef(false);
  const onReplyRef = useRef(options.onAgentReply);
  onReplyRef.current = options.onAgentReply;

  const artifactsApi = useArtifacts(selectedId);

  // ─── Local message state (kept in a ref so persistence sees latest) ─────────

  const setThread = useCallback((next: StudioMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const patchMessage = useCallback(
    (id: string, fn: (m: StudioMessage) => StudioMessage) => {
      const next = messagesRef.current.map((m) => (m.id === id ? fn(m) : m));
      messagesRef.current = next;
      setMessages(next);
    },
    []
  );

  // ─── Projects ───────────────────────────────────────────────────────────────

  const selectProject = useCallback(
    (id: string) => {
      setSelectedId(id);
      setThread(loadMessages(id));
    },
    [setThread]
  );

  const createProject = useCallback(
    (name: string, agentIds: string[], avatar?: string) => {
      const project = storageCreateProject(name, agentIds, avatar);
      setProjects(loadProjects());
      setSelectedId(project.id);
      setThread([]);
      return project;
    },
    [setThread]
  );

  const renameProject = useCallback(
    (id: string, patch: Partial<Pick<StudioProject, "name" | "avatar" | "agentIds">>) => {
      storageUpdateProject(id, patch);
      setProjects(loadProjects());
    },
    []
  );

  const removeProject = useCallback(
    (id: string) => {
      storageDeleteProject(id);
      const remaining = loadProjects();
      setProjects(remaining);
      if (selectedId === id) {
        const next = remaining[0] ?? null;
        setSelectedId(next?.id ?? null);
        setThread(next ? loadMessages(next.id) : []);
      }
    },
    [selectedId, setThread]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  const roles = useMemo(
    () =>
      (selectedProject?.agentIds ?? [])
        .map((id) => agents.find((a) => a.id === id))
        .filter(Boolean) as AgentDefinition[],
    [selectedProject, agents]
  );

  const addRole = useCallback(
    (agentId: string) => {
      if (!selectedProject) return;
      if (selectedProject.agentIds.includes(agentId)) return;
      renameProject(selectedProject.id, {
        agentIds: [...selectedProject.agentIds, agentId],
      });
    },
    [selectedProject, renameProject]
  );

  const removeRole = useCallback(
    (agentId: string) => {
      if (!selectedProject) return;
      renameProject(selectedProject.id, {
        agentIds: selectedProject.agentIds.filter((id) => id !== agentId),
      });
    },
    [selectedProject, renameProject]
  );

  const clearThread = useCallback(() => {
    if (!selectedId) return;
    clearMessages(selectedId);
    setThread([]);
  }, [selectedId, setThread]);

  // ─── Single agent turn (full PI capabilities) ───────────────────────────────

  const runAgentTurn = useCallback(
    async (
      agent: AgentDefinition,
      promptText: string,
      images: ImageContent[],
      handlers: {
        onDelta: (text: string) => void;
        onToolStart?: (tc: StudioToolCall) => void;
        onToolEnd?: (info: {
          toolCallId: string;
          resultText: string;
          isError: boolean;
        }) => void;
      }
    ): Promise<{ text: string; tools: StudioToolCall[] }> => {
      const tools: StudioToolCall[] = [];
      let text = "";
      const runtime = await createAgentRuntime(
        agent,
        {
          onAssistantDelta: (t) => {
            text = t;
            handlers.onDelta(t);
          },
          onAssistantEnd: (t) => {
            if (t) text = t;
          },
          onToolStart: (info) => {
            const tc: StudioToolCall = {
              toolCallId: info.toolCallId,
              toolName: info.toolName,
              args: info.args,
              done: false,
            };
            tools.push(tc);
            handlers.onToolStart?.(tc);
          },
          onToolEnd: (info) => {
            const tc = tools.find((t) => t.toolCallId === info.toolCallId);
            if (tc) {
              tc.resultText = info.resultText;
              tc.isError = info.isError;
              tc.done = true;
            }
            handlers.onToolEnd?.({
              toolCallId: info.toolCallId,
              resultText: info.resultText,
              isError: info.isError,
            });
          },
          onError: (message) => {
            if (!text) text = `⚠️ ${message}`;
          },
        },
        {
          skills: useSkillStore.getState().items,
          mcpServers: useMcpStore.getState().items,
          providerVariables: selectedAIProvider.variables,
        }
      );
      runtimeRef.current = runtime;
      await runtime.prompt(promptText, images.length ? images : undefined);
      await runtime.waitForIdle();
      return { text, tools };
    },
    [selectedAIProvider.variables]
  );

  // ─── Send a user message → sequential multi-agent replies ───────────────────

  const send = useCallback(
    async (input: string, opts: SendOptions = {}) => {
      if (!selectedId || isSending) return;
      const text = input.trim();
      const attachments = opts.attachments ?? [];
      if (!text && attachments.length === 0) return;

      const project = projects.find((p) => p.id === selectedId);
      if (!project) return;

      abortedRef.current = false;
      setIsSending(true);

      // 1. append user message
      const userMsg: StudioMessage = {
        id: makeId(),
        projectId: selectedId,
        role: "user",
        content: text,
        attachments: attachments.length ? attachments : undefined,
        timestamp: new Date().toISOString(),
      };
      setThread([...messagesRef.current, userMsg]);

      // 2. resolve responders (mentions filter, else all roles)
      const roleAgents = project.agentIds
        .map((id) => agents.find((a) => a.id === id))
        .filter(Boolean) as AgentDefinition[];
      const mentions = [...text.matchAll(/@(\S+)/g)].map((m) =>
        m[1].toLowerCase()
      );
      let responders =
        mentions.length > 0
          ? roleAgents.filter((a) =>
              mentions.some((mn) => a.name.toLowerCase().includes(mn))
            )
          : roleAgents;
      if (responders.length === 0) responders = roleAgents;
      if (opts.planMode) responders = responders.slice(0, 1); // single planner

      const images = toImages(attachments);
      const extraFiles = filesBlock(attachments);

      // 3. each responder streams in turn
      for (const agent of responders) {
        if (abortedRef.current) break;

        const pid = makeId();
        const placeholder: StudioMessage = {
          id: pid,
          projectId: selectedId,
          role: "agent",
          agentId: agent.id,
          agentName: agent.name,
          agentAvatar: agent.avatar,
          content: "",
          tools: [],
          timestamp: new Date().toISOString(),
        };
        setThread([...messagesRef.current, placeholder]);
        setStreamingIds((s) => new Set(s).add(pid));

        const transcript = buildTranscript(
          messagesRef.current.filter((m) => m.id !== pid)
        );
        const others = responders
          .filter((a) => a.id !== agent.id)
          .map((a) => a.name)
          .join("、");
        let promptText = `${transcript}\n\n现在请你以「${agent.name}${
          agent.role ? `（${agent.role}）` : ""
        }」的身份，参与创作项目「${project.name}」，回应上面的对话。${
          others ? `其他成员：${others}。` : ""
        }请保持角色特点，简洁而有见地。${extraFiles}`;
        if (opts.planMode) promptText += PLAN_INSTRUCTION;

        let result: { text: string; tools: StudioToolCall[] };
        try {
          result = await runAgentTurn(agent, promptText, images, {
            onDelta: (t) => patchMessage(pid, (m) => ({ ...m, content: t })),
            onToolStart: (tc) =>
              patchMessage(pid, (m) => ({
                ...m,
                tools: [...(m.tools ?? []), tc],
              })),
            onToolEnd: (info) =>
              patchMessage(pid, (m) => ({
                ...m,
                tools: (m.tools ?? []).map((t) =>
                  t.toolCallId === info.toolCallId
                    ? {
                        ...t,
                        resultText: info.resultText,
                        isError: info.isError,
                        done: true,
                      }
                    : t
                ),
              })),
          });
        } catch (err) {
          result = {
            text: `⚠️ ${err instanceof Error ? err.message : String(err)}`,
            tools: [],
          };
        }

        // finalize this placeholder
        const parsed = opts.planMode ? parsePlan(result.text) : null;
        patchMessage(pid, (m) => ({
          ...m,
          content: parsed ? parsed.lead : result.text,
          tools: result.tools.length ? result.tools : m.tools,
          plan: parsed ? parsed.plan : undefined,
        }));
        saveMessages(selectedId, messagesRef.current);

        setStreamingIds((s) => {
          const next = new Set(s);
          next.delete(pid);
          return next;
        });

        if (!parsed && result.text.trim()) onReplyRef.current?.(result.text);
      }

      saveMessages(selectedId, messagesRef.current);
      setIsSending(false);
    },
    [selectedId, isSending, projects, agents, runAgentTurn, patchMessage, setThread]
  );

  // ─── Confirm a plan → create + author artifacts ─────────────────────────────

  const confirmPlan = useCallback(
    async (planMsg: StudioMessage) => {
      if (!selectedId || !planMsg.plan || isSending) return;
      const project = projects.find((p) => p.id === selectedId);
      if (!project) return;
      const author =
        (project.agentIds
          .map((id) => agents.find((a) => a.id === id))
          .filter(Boolean)[0] as AgentDefinition | undefined) ?? undefined;

      abortedRef.current = false;
      setIsSending(true);

      patchMessage(planMsg.id, (m) => ({
        ...m,
        plan: m.plan ? { ...m.plan, confirmed: true } : m.plan,
      }));
      saveMessages(selectedId, messagesRef.current);

      for (const item of planMsg.plan.plans) {
        if (abortedRef.current) break;
        const artifact = await artifactsApi.create({
          projectId: selectedId,
          title: item.title,
          content: "",
          status: "draft",
          sourcePlanId: planMsg.id,
          authorAgentId: author?.id,
          authorAgentName: author?.name,
        });
        if (!author) continue;

        await artifactsApi.update(artifact.id, { status: "generating" });
        setGeneratingArtifactId(artifact.id);
        setLiveContent("");

        const promptText = `请根据以下写作指令，创作《${item.title}》的正文，使用 Markdown 格式，内容完整、结构清晰、可直接发布：\n\n写作指令：${item.prompt}\n\n补充说明：${item.summary}`;
        let text = "";
        try {
          const res = await runAgentTurn(author, promptText, [], {
            onDelta: (t) => {
              text = t;
              setLiveContent(t);
            },
          });
          text = res.text;
        } catch (err) {
          text = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }

        await artifactsApi.update(artifact.id, {
          content: text,
          status: "done",
        });
        setGeneratingArtifactId(null);
        setLiveContent("");
      }

      setIsSending(false);
    },
    [selectedId, isSending, projects, agents, artifactsApi, runAgentTurn, patchMessage]
  );

  // ─── Regenerate an existing artifact ────────────────────────────────────────

  const regenerateArtifact = useCallback(
    async (artifactId: string, instruction: string) => {
      if (!selectedId || isSending) return;
      const artifact = artifactsApi.artifacts.find((a) => a.id === artifactId);
      if (!artifact) return;
      const author =
        artifact.authorAgentId
          ? agents.find((a) => a.id === artifact.authorAgentId)
          : roles[0];
      if (!author) return;

      abortedRef.current = false;
      setIsSending(true);
      await artifactsApi.update(artifactId, { status: "generating" });
      setGeneratingArtifactId(artifactId);
      setLiveContent(artifact.content);

      const promptText = `这是《${artifact.title}》的当前内容：\n\n${artifact.content}\n\n请根据以下要求修改并输出完整的新版正文（Markdown）：\n${instruction}`;
      let text = artifact.content;
      try {
        const res = await runAgentTurn(author, promptText, [], {
          onDelta: (t) => {
            text = t;
            setLiveContent(t);
          },
        });
        text = res.text;
      } catch (err) {
        text = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
      }
      await artifactsApi.update(artifactId, { content: text, status: "done" });
      setGeneratingArtifactId(null);
      setLiveContent("");
      setIsSending(false);
    },
    [selectedId, isSending, artifactsApi, agents, roles, runAgentTurn]
  );

  const stop = useCallback(() => {
    abortedRef.current = true;
    runtimeRef.current?.abort();
    setIsSending(false);
    setStreamingIds(new Set());
    setGeneratingArtifactId(null);
  }, []);

  // Keep the thread in sync if the selected project's stored messages change
  // externally (e.g. first mount before projects loaded).
  useEffect(() => {
    if (selectedId && messagesRef.current.length === 0) {
      const stored = loadMessages(selectedId);
      if (stored.length) setThread(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return {
    // project state
    projects,
    selectedId,
    selectedProject,
    roles,
    messages,
    isSending,
    streamingIds,
    agents,
    // artifacts
    artifacts: artifactsApi.artifacts,
    generatingArtifactId,
    liveContent,
    // project ops
    selectProject,
    createProject,
    renameProject,
    removeProject,
    addRole,
    removeRole,
    clearThread,
    // conversation
    send,
    stop,
    // plan + artifacts
    confirmPlan,
    regenerateArtifact,
    updateArtifact: artifactsApi.update,
    removeArtifact: artifactsApi.remove,
  };
}
