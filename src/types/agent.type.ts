/**
 * Types for the Pi-based multi-agent architecture.
 *
 * These mirror the domain model used by the in-app Pi agent: reusable agent
 * definitions, skills (Pi/Claude style), and MCP server records. Persistence is
 * handled by the localStorage-backed stores in `@/lib/storage`.
 */

/** Common identity + timestamps for every persisted agent-domain entity. */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Sandbox mode gating the agent's internal file/bash tools. */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** Internal tools the agent can run (backed by Tauri commands). */
export type AgentInternalToolId =
  | "checkpoint"
  | "bash"
  | "read"
  | "write"
  | "edit"
  | "ls"
  | "grep"
  | "file_search"
  | "web_search"
  | "ima_search"
  | "open_article"
  | "generate_image"
  | "search_images"
  | "save_web_image"
  | "consolidate_draft_images";

/** Every internal tool id, in display order. */
export const AGENT_INTERNAL_TOOL_IDS: AgentInternalToolId[] = [
  "checkpoint",
  "bash",
  "read",
  "write",
  "edit",
  "ls",
  "grep",
  "file_search",
  "web_search",
  "ima_search",
  "open_article",
  "generate_image",
  "search_images",
  "save_web_image",
  "consolidate_draft_images",
];

/** Wire format used to talk to a model provider. */
export type AgentApiKind = "openai-completions" | "anthropic-messages";

/** A single file belonging to a multi-file skill, stored verbatim. */
export interface SkillFile {
  /** POSIX-relative path within the skill directory, e.g. "references/x.md". */
  path: string;
  /** File content: UTF-8 text, or base64 when `encoding` is "base64". */
  content: string;
  encoding: "utf8" | "base64";
}

/**
 * A Pi/Claude-style skill: name + description are advertised to the model, and
 * the full markdown `content` is loaded on demand via the `load_skill` tool.
 */
export interface Skill extends BaseEntity {
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  content?: string;
  /**
  * How the skill was obtained. Absent means manual. "niuma" means it was
  * bridged from a `.niuma/skills/<slug>/SKILL.md` entry (see
  * `bridgeEnabledNiumaSkills`) — `source` holds the skill slug.
   */
  sourceType?: "manual" | "github" | "niuma";
  /** For github skills: "owner/repo". For .niuma skills: the slug. */
  source?: string;
  /** For github skills: path to SKILL.md within the repo. */
  skillPath?: string;
  /** For github skills: branch / tag / commit the content was pulled from. */
  sourceRef?: string;
  /** sha256 of the installed SKILL.md content, for update detection. */
  installedHash?: string;
  /** Full file set for multi-file skills. */
  files?: SkillFile[];
}

/** Transport used to reach an MCP server. */
export type McpTransport = "stdio" | "sse" | "http";

/** A configured MCP server whose tools can be exposed to the agent. */
export interface McpServer extends BaseEntity {
  name: string;
  description?: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  url?: string;
  env: Record<string, string>;
  enabled: boolean;
}

/** A co-authored artifact produced by an agent and associated with a Studio project. */
export interface Artifact extends BaseEntity {
  /** The Studio project this artifact belongs to. */
  projectId: string;
  /** Human-readable artifact name. */
  name: string;
  /** Primary content: markdown, code, etc. */
  content?: string;
  /** MIME type or kind hint, e.g. "text/markdown", "code/typescript". */
  kind?: string;
  /** Optional free-form metadata. */
  meta?: Record<string, unknown>;
}

/**
 * A reusable agent configuration. Combines a system prompt, a model reference,
 * the enabled tool set (internal + skills + MCP), and runtime parameters.
 */
export interface AgentDefinition extends BaseEntity {
  name: string;
  /** Display role / title shown on the talent market card (e.g. "前端工程师"). */
  role?: string;
  /** Avatar: an emoji string or an absolute URL to an image. */
  avatar?: string;
  description: string;
  /** Full base system prompt (skills block is appended at run time). */
  systemPrompt: string;
  /**
   * Model reference: the niuma provider id this agent talks to. The concrete
   * model id / API key come from the provider's saved variables.
   */
  providerId: string;
  /** Model id to request from the provider (e.g. "gpt-4o"). */
  modelId: string;
  enabledInternalTools: AgentInternalToolId[];
  enabledSkillIds: string[];
  enabledMcpServerIds: string[];
  sandboxMode: SandboxMode;
  temperature: number;
  maxTokens: number;
  /** Absolute execution root for local tools. Empty = managed temp sandbox. */
  workspacePath: string;
}
