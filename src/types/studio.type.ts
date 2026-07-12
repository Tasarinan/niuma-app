/**
 * Types for the local multi-agent collaborative creation "Studio".
 *
 * A Studio project is a workspace where one human collaborates with several
 * AI roles (agents) to discuss, plan, and co-author shared documents
 * (artifacts). It reuses the Pi agent runtime so every role keeps full PI
 * capabilities: skills, MCP tools, internal tools, and tool-call rendering.
 */

import type { BaseEntity } from "./agent.type";

/** A creation project: named workspace with a set of AI role members. */
export interface StudioProject {
  id: string;
  name: string;
  /** Emoji or /clawpacks/talent_icon/... URL. */
  avatar: string;
  /** IDs of AgentDefinition members acting as roles in this project. */
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Message author kind. `plan` and `confirm` are structured system turns. */
export type StudioMessageRole = "user" | "agent" | "plan";

/** A tool call surfaced from the Pi runtime for a single agent turn. */
export interface StudioToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
  resultText?: string;
  isError?: boolean;
  done: boolean;
}

/** One item of a structured creation plan. */
export interface StudioPlanItem {
  title: string;
  summary: string;
  /** Writing instruction handed to the author agent to produce the artifact. */
  prompt: string;
}

/** A structured plan proposed by a planning agent. */
export interface StudioPlan {
  plans: StudioPlanItem[];
  /** True once the plan has been confirmed and artifacts were created. */
  confirmed?: boolean;
}

/** An attachment carried by a user message. */
export interface StudioAttachment {
  id: string;
  name: string;
  kind: "image" | "file";
  mimeType: string;
  /** base64 (no data: prefix) for images; UTF-8 text for files. */
  data: string;
}

/** A single message in a Studio project thread. */
export interface StudioMessage {
  id: string;
  projectId: string;
  role: StudioMessageRole;
  /** Set when role === "agent". */
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  content: string;
  /** Tool calls made during an assistant turn. */
  tools?: StudioToolCall[];
  /** Structured plan payload when role === "plan". */
  plan?: StudioPlan;
  /** Attachments carried by a user message. */
  attachments?: StudioAttachment[];
  timestamp: string;
}

/** Lifecycle of a co-authored document. */
export type ArtifactStatus = "draft" | "generating" | "done";

/** A shared document co-authored inside a Studio project. */
export interface Artifact extends BaseEntity {
  projectId: string;
  title: string;
  /** Markdown body. */
  content: string;
  status: ArtifactStatus;
  /** Optional cover image (emoji or URL). */
  coverImage?: string;
  /** The plan message this artifact was generated from, if any. */
  sourcePlanId?: string;
  /** The agent that authored the content, if any. */
  authorAgentId?: string;
  authorAgentName?: string;
}
