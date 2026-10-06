/** Types for Discord/Slack-style group chat channels. */

/** A named channel with a set of AI agent members. */
export interface GroupChannel {
  id: string;
  name: string;
  /** Emoji or /talent_icon/... URL used as the channel avatar. */
  avatar: string;
  /** IDs of AgentDefinition members in this channel. */
  agentIds: string[];
  /** Short user-defined labels shown in the channel list. */
  tags?: string[];
  /** Deprecated: kept in storage for old channels. UI follows the bound team. */
  kind?: "chat" | "meeting";
  /** Slug of the bound team in .niuma/teams/<teamId>/. When set, the channel auto-loads that team's agents, skills, and commands. */
  teamId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A single message in a group channel. */
export interface GroupMessage {
  id: string;
  channelId: string;
  /** "user" = human, "agent" = AI response. */
  role: "user" | "agent";
  /** Only set when role === "agent". */
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  content: string;
  /** Images attached to a user message (multimodal input), if any. */
  images?: { mimeType: string; data: string }[];
  /** ISO timestamp. */
  timestamp: string;
  /** Live tool/skill progress for the current turn. Not persisted. */
  toolProgress?: GroupToolProgress[];
}

export interface GroupToolProgress {
  toolCallId: string;
  toolName: string;
  label: string;
  done: boolean;
  isError?: boolean;
}
