import type { GroupChannel, GroupMessage } from "@/types";

const CHANNELS_KEY = "niuma:group-channels";
const messagesKey = (channelId: string) => `niuma:group-messages:${channelId}`;

// ─── Channels ─────────────────────────────────────────────────────────────────

export function loadChannels(): GroupChannel[] {
  try {
    const raw = localStorage.getItem(CHANNELS_KEY);
    return raw ? (JSON.parse(raw) as GroupChannel[]) : [];
  } catch {
    return [];
  }
}

export function saveChannels(channels: GroupChannel[]): void {
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
}

export function createChannel(
  name: string,
  agentIds: string[],
  avatar = "💬",
  kind: GroupChannel["kind"] = "chat"
): GroupChannel {
  const now = new Date().toISOString();
  const channel: GroupChannel = {
    id: crypto.randomUUID(),
    name,
    avatar,
    agentIds,
    kind,
    createdAt: now,
    updatedAt: now,
  };
  saveChannels([channel, ...loadChannels()]);
  return channel;
}

export function updateChannel(
  id: string,
  patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind">>
): void {
  const channels = loadChannels().map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
  );
  saveChannels(channels);
}

export function deleteChannel(id: string): void {
  saveChannels(loadChannels().filter((c) => c.id !== id));
  localStorage.removeItem(messagesKey(id));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function loadMessages(channelId: string): GroupMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(channelId));
    return raw ? (JSON.parse(raw) as GroupMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(channelId: string, messages: GroupMessage[]): void {
  localStorage.setItem(messagesKey(channelId), JSON.stringify(messages));
}

export function appendMessage(msg: GroupMessage): void {
  const messages = loadMessages(msg.channelId);
  saveMessages(msg.channelId, [...messages, msg]);
}

export function clearMessages(channelId: string): void {
  localStorage.removeItem(messagesKey(channelId));
}
