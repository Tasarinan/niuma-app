/** Types for Discord/Slack-style group chat channels. */

/** A named channel with a set of AI agent members. */
export interface GroupChannel {
  id: string;
  name: string;
  /** Emoji or /talent_icon/... URL used as the channel avatar. */
  avatar: string;
  /** IDs of AgentDefinition members in this channel. */
  agentIds: string[];
  /** Channel type. "meeting" channels enable live meeting transcription/diarization. Defaults to "chat" when unset. */
  kind?: "chat" | "meeting";
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
}
