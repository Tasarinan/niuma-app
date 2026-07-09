/**
 * Agent runtime: bind an `AgentDefinition` to the Pi `Agent` and bridge its
 * event stream to UI-facing callbacks.
 *
 * Unlike LLMToolForge (which routes through a local Unified gateway), niuma
 * talks to the configured provider directly. The caller passes the resolved
 * provider connection plus the enabled skills / MCP servers, so this module
 * stays decoupled from the app's state management.
 */

import { Agent } from "@earendil-works/pi-agent-core";
import type {
  AgentEvent,
  AgentMessage,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { AgentDefinition, McpServer, Skill } from "@/types";
import { buildPiModel } from "./model";
import { createDirectRuntime } from "./provider";
import { resolveProviderConnection, type ProviderConnection } from "./connection";
import { resolveAgent } from "./agent-definition";
import { ensureAgentFetch } from "./agent-fetch";
import { sanitizeLeakedToolCallText } from "./leaked-tool-call-text";
import type { CheckpointRequest, RequestCheckpoint } from "./tools/internal";

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export interface AgentToolStartInfo {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface AgentToolEndInfo {
  toolCallId: string;
  toolName: string;
  resultText: string;
  resultJson: unknown;
  isError: boolean;
}

export interface AgentRuntimeCallbacks {
  /** A new assistant turn began (new message bubble). */
  onAssistantStart?: () => void | Promise<void>;
  /** Accumulated text of the current assistant turn. */
  onAssistantDelta?: (text: string) => void | Promise<void>;
  /** Current assistant turn finished. */
  onAssistantEnd?: (text: string) => void | Promise<void>;
  onToolStart?: (info: AgentToolStartInfo) => void | Promise<void>;
  onToolEnd?: (info: AgentToolEndInfo) => void | Promise<void>;
  /** A fatal turn error (also ends the run). */
  onError?: (message: string) => void | Promise<void>;
  /** Run finished (idle). */
  onDone?: () => void | Promise<void>;
}

export interface AgentRuntime {
  prompt: (input: string) => Promise<void>;
  abort: () => void;
  waitForIdle: () => Promise<void>;
  /** MCP servers that failed to inspect while building tools. */
  mcpErrors: { server: string; error: string }[];
  /** MCP servers still warming up in the background (skipped this turn). */
  mcpPending: string[];
}

export interface AgentRuntimeDeps {
  /** Enabled skills available to the `load_skill` tool. */
  skills: Skill[];
  /** MCP servers whose tools may be exposed. */
  mcpServers: McpServer[];
  /**
   * The saved provider selection variables (API_KEY / MODEL / …). Used to
   * resolve the concrete connection for the agent's `providerId`.
   */
  providerVariables: Record<string, string>;
  /** Pre-resolved connection, used instead of resolving from `providerVariables`. */
  connection?: ProviderConnection;
}

export interface AgentRuntimeOptions {
  workspacePath?: string;
  requestCheckpoint?: RequestCheckpoint;
  autoCheckpoint?: boolean;
}

/** Extract plain text from an assistant message's content blocks. */
function assistantText(message: AgentMessage): string {
  if (message.role !== "assistant") return "";
  const text = message.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
  return sanitizeLeakedToolCallText(text);
}

function resultToText(result: AgentToolResult<unknown> | undefined): string {
  if (!result?.content) return "";
  return result.content
    .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
    .join("\n");
}

function previewValue(value: unknown, max = 1200): string {
  let text: string;
  try {
    text =
      typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2);
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function autoCheckpointRequest(
  toolCallId: string,
  toolName: string,
  args: unknown
): CheckpointRequest | null {
  if (toolName === "checkpoint") return null;
  if (toolName === "write" || toolName === "edit") {
    return {
      toolCallId,
      title: `Approve ${toolName}`,
      summary:
        "The agent is about to modify files without first calling the checkpoint tool.",
      proposedAction: `${toolName} ${previewValue(args)}`,
      risk: "This may change files on disk.",
    };
  }
  if (toolName === "bash") {
    const command =
      args && typeof args === "object" && "command" in args
        ? String((args as { command?: unknown }).command ?? "")
        : "";
    return {
      toolCallId,
      title: "Approve command",
      summary:
        "The agent is about to run a shell command without first calling the checkpoint tool.",
      proposedAction: command,
      risk: "Shell commands can modify the system.",
      artifacts: [command],
    };
  }
  return null;
}

/**
 * Create a runtime for `def`. Throws `ProviderUnavailableError` when the
 * provider connection cannot be resolved.
 */
export async function createAgentRuntime(
  def: AgentDefinition,
  callbacks: AgentRuntimeCallbacks,
  deps: AgentRuntimeDeps,
  options: AgentRuntimeOptions = {}
): Promise<AgentRuntime> {
  let connection: ProviderConnection;
  try {
    connection =
      deps.connection ??
      resolveProviderConnection(def.providerId, deps.providerVariables, def.modelId);
  } catch (err) {
    throw new ProviderUnavailableError(
      err instanceof Error ? err.message : String(err)
    );
  }

  await ensureAgentFetch(connection.host);
  const piModel = buildPiModel(connection, { maxTokens: def.maxTokens });
  const { streamFn } = createDirectRuntime([piModel], connection);

  const resolved = await resolveAgent(def, {
    skills: deps.skills,
    mcpServers: deps.mcpServers,
    workspacePath: options.workspacePath ?? def.workspacePath,
    requestCheckpoint: options.requestCheckpoint,
  });

  const agent = new Agent({
    initialState: {
      systemPrompt: resolved.systemPrompt,
      model: piModel,
      tools: resolved.tools,
    },
    streamFn,
    beforeToolCall: async ({ toolCall, args }, signal) => {
      if (!options.autoCheckpoint) return undefined;
      const request = autoCheckpointRequest(toolCall.id, toolCall.name, args);
      if (!request) return undefined;
      if (!options.requestCheckpoint) {
        return {
          block: true,
          reason: "Checkpoint approval UI is not available",
        };
      }
      const decision = await options.requestCheckpoint(request, signal);
      if (decision.approved) return undefined;
      return {
        block: true,
        reason: decision.note
          ? `Human rejected checkpoint: ${decision.note}`
          : "Human rejected checkpoint",
      };
    },
  });

  agent.subscribe(async (event: AgentEvent) => {
    switch (event.type) {
      case "message_start":
        if ((event.message as AgentMessage).role === "assistant") {
          await callbacks.onAssistantStart?.();
        }
        break;
      case "message_update":
        if ((event.message as AgentMessage).role === "assistant") {
          await callbacks.onAssistantDelta?.(assistantText(event.message));
        }
        break;
      case "message_end":
        if ((event.message as AgentMessage).role === "assistant") {
          const msg = event.message as Extract<
            AgentMessage,
            { role: "assistant" }
          >;
          if (msg.errorMessage) {
            await callbacks.onError?.(msg.errorMessage);
          } else {
            await callbacks.onAssistantEnd?.(assistantText(event.message));
          }
        }
        break;
      case "tool_execution_start":
        await callbacks.onToolStart?.({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;
      case "tool_execution_end":
        await callbacks.onToolEnd?.({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          resultText: resultToText(event.result),
          resultJson: event.result?.details,
          isError: event.isError,
        });
        break;
      case "agent_end":
        await callbacks.onDone?.();
        break;
      default:
        break;
    }
  });

  return {
    prompt: async (input: string) => {
      await agent.prompt(input);
    },
    abort: () => agent.abort(),
    waitForIdle: () => agent.waitForIdle(),
    mcpErrors: resolved.mcpErrors,
    mcpPending: resolved.mcpPending,
  };
}
