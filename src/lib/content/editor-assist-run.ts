import { resolveProviderConnection, type ProviderConnection } from "@/lib/agent/connection";
import { DIRECT_PROVIDER_ID } from "@/lib/agent/model";
import { createAgentRuntime } from "@/lib/agent/runtime";
import { loadAgentCatalog, type CatalogAgent } from "@/lib/data/agent-loader";
import { getProvider } from "@/lib/providers/registry";
import { getActiveApiProvider, getActiveProvider } from "@/lib/providers/storage";
import type { AgentDefinition, AgentInternalToolId, SandboxMode } from "@/types";
import {
  editorAssistMessages,
  pickAssistTeamAgent,
  preferredAssistAgentName,
  unwrapAssistText,
  type EditorAssistRequest,
} from "@/lib/content/editor-assist";

function overlayAssistPrompt(base: string, overlay: string): string {
  const head = base.trim();
  return head ? `${head}\n\n${overlay}` : overlay;
}

export function explainAssistProviderError(msg: string): string {
  if (/no api key/i.test(msg) || /niuma-direct/i.test(msg) || /requires an api key/i.test(msg)) {
    return "当前没有可用的 API Key。选区助手直接用 .teams 里的角色，模型走「设置 → AI 提供商」里的 API Key。请填写 Key，不要用网页零 Token。";
  }
  return msg;
}

/** Same provider rules as chat: API provider + key, never web / niuma-direct. */
export function resolveAssistConnection(agent?: { providerId?: string; modelId?: string }): ProviderConnection {
  const active = getActiveApiProvider() ?? getActiveProvider();
  const requested = agent?.providerId?.trim() ?? "";
  const skipRequested = !requested || requested === DIRECT_PROVIDER_ID;
  const providerId = skipRequested ? (active?.providerId ?? "").trim() : requested;
  const model =
    (skipRequested ? active?.model : agent?.modelId)?.trim() ||
    active?.model?.trim() ||
    agent?.modelId?.trim() ||
    "";

  if (!providerId) {
    throw new Error("没有可用的 API 提供商。请在「设置 → AI 提供商」配置并填写 Key。");
  }

  const def = getProvider(providerId);
  if (def?.type === "web") {
    throw new Error(
      `网页零Token提供商「${def.name}」不能用于选区助手。请切换到 API 提供商并填写 Key。`,
    );
  }

  try {
    return resolveProviderConnection(providerId, {}, model || undefined);
  } catch (err) {
    const fallbackId = active?.providerId?.trim() ?? "";
    if (fallbackId && fallbackId !== providerId && fallbackId !== DIRECT_PROVIDER_ID) {
      const fallback = getProvider(fallbackId);
      if (fallback && fallback.type !== "web") {
        return resolveProviderConnection(fallbackId, {}, active?.model);
      }
    }
    throw err;
  }
}

function catalogToDefinition(agent: CatalogAgent, now: string): AgentDefinition {
  return {
    id: agent.id,
    createdAt: now,
    updatedAt: now,
    name: agent.name,
    role: agent.role,
    avatar: agent.avatar,
    description: agent.description,
    systemPrompt: agent.systemPrompt ?? "",
    providerId: agent.providerId ?? "",
    modelId: agent.modelId ?? "",
    enabledInternalTools: (agent.enabledInternalTools ?? []) as AgentInternalToolId[],
    enabledSkillIds: agent.enabledSkillIds ?? [],
    enabledMcpServerIds: agent.enabledMcpServerIds ?? [],
    sandboxMode: (agent.sandboxMode ?? "read-only") as SandboxMode,
    temperature: agent.temperature ?? 0.4,
    maxTokens: agent.maxTokens ?? 4096,
    workspacePath: agent.workspacePath ?? "",
  };
}

async function loadTeamSeat(request: EditorAssistRequest): Promise<CatalogAgent> {
  const teamId = request.teamId?.trim() || "content";
  const catalog = await loadAgentCatalog();
  const agent = pickAssistTeamAgent(catalog, request.kind, {
    teamId,
    names: request.agentNames,
  });
  if (!agent) {
    throw new Error(`没有找到 .teams/${teamId}/agents 里对应的角色。请确认该团队的写手、主编、配图师、发行文件还在。`);
  }
  return agent;
}

/** One model turn for the floating editor bar. Seat comes from `.teams/<team>/agents/`. */
export async function runEditorAssist(request: EditorAssistRequest): Promise<string> {
  const catalogAgent = await loadTeamSeat(request);
  let connection: ProviderConnection;
  try {
    connection = resolveAssistConnection(catalogAgent);
  } catch (err) {
    throw new Error(explainAssistProviderError(err instanceof Error ? err.message : String(err)));
  }

  const { system, user } = editorAssistMessages(request);
  const now = new Date().toISOString();
  const seat =
    catalogAgent.name.trim() || preferredAssistAgentName(request.kind, request.agentNames) || "编辑助手";
  const def = catalogToDefinition(catalogAgent, now);
  def.name = seat;
  def.providerId = connection.providerId;
  def.modelId = connection.model;
  def.systemPrompt = overlayAssistPrompt(catalogAgent.systemPrompt ?? "", system);
  def.enabledInternalTools = [];
  def.enabledSkillIds = [];
  def.enabledMcpServerIds = [];
  def.sandboxMode = "read-only";
  def.temperature = request.kind.startsWith("review") ? 0.2 : catalogAgent.temperature ?? 0.4;
  def.maxTokens = request.kind === "review-document" ? 4096 : catalogAgent.maxTokens ?? 4096;

  let finalText = "";
  let errorMsg: string | null = null;
  const runtime = await createAgentRuntime(
    def,
    {
      onAssistantDelta: (text) => {
        finalText = text;
      },
      onAssistantEnd: (text) => {
        if (text.trim()) finalText = text;
      },
      onError: (msg) => {
        errorMsg = msg;
      },
    },
    {
      skills: [],
      mcpServers: [],
      connection,
      providerVariables: {},
    },
  );

  await runtime.prompt(user);
  await runtime.waitForIdle();
  if (errorMsg) throw new Error(explainAssistProviderError(errorMsg));
  const text = unwrapAssistText(finalText);
  if (!text) throw new Error("模型没有返回内容。");
  return text;
}
