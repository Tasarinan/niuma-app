/**
 * Group-chat storage — pure localStorage.
 * Channels and messages are persisted only in the browser’s localStorage.
 */

import type { GroupChannel, GroupMessage } from "@/types";

const LS_CHANNELS_KEY = "niuma:group-channels";
const lsMessagesKey = (id: string) => `niuma:group-messages:${id}`;

function readChannelsFromLS(): GroupChannel[] {
  try {
    const raw = localStorage.getItem(LS_CHANNELS_KEY);
    return raw ? (JSON.parse(raw) as GroupChannel[]) : [];
  } catch { return []; }
}

function readMessagesFromLS(channelId: string): GroupMessage[] {
  try {
    const raw = localStorage.getItem(lsMessagesKey(channelId));
    return raw ? (JSON.parse(raw) as GroupMessage[]) : [];
  } catch { return []; }
}

let channelCache: GroupChannel[] = readChannelsFromLS();
const messageCache = new Map<string, GroupMessage[]>();

// ── Init (no-op — data already loaded from localStorage above) ───────────────

export async function initGroupChatStorage(): Promise<void> {}

// ── Channels ──────────────────────────────────────────────────────────────────

export function loadChannels(): GroupChannel[] {
  return channelCache;
}

export function saveChannels(channels: GroupChannel[]): void {
  channelCache = channels;
  try { localStorage.setItem(LS_CHANNELS_KEY, JSON.stringify(channels)); } catch { }
}

export function createChannel(
  name: string,
  agentIds: string[],
  avatar = "chat",
  kind: GroupChannel["kind"] = "chat",
  tags: string[] = [],
  teamId?: string
): GroupChannel {
  const now = new Date().toISOString();
  const channel: GroupChannel = {
    id: crypto.randomUUID(),
    name,
    avatar,
    agentIds,
    tags,
    kind,
    ...(teamId ? { teamId } : {}),
    createdAt: now,
    updatedAt: now,
  };
  channelCache = [channel, ...channelCache];
  try { localStorage.setItem(LS_CHANNELS_KEY, JSON.stringify(channelCache)); } catch { }
  return channel;
}

export function updateChannel(
  id: string,
  patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags" | "teamId">>
): void {
  channelCache = channelCache.map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
  );
  try { localStorage.setItem(LS_CHANNELS_KEY, JSON.stringify(channelCache)); } catch { }
}

export function deleteChannel(id: string): void {
  channelCache = channelCache.filter((c) => c.id !== id);
  messageCache.delete(id);
  localStorage.removeItem(lsMessagesKey(id));
  try { localStorage.setItem(LS_CHANNELS_KEY, JSON.stringify(channelCache)); } catch { }
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function loadMessages(channelId: string): GroupMessage[] {
  // Return cache hit; fall back to localStorage for first access before async init
  if (messageCache.has(channelId)) return messageCache.get(channelId)!;
  const lsMsgs = readMessagesFromLS(channelId);
  if (lsMsgs.length > 0) messageCache.set(channelId, lsMsgs);
  return lsMsgs;
}

export async function loadMessagesAsync(channelId: string): Promise<GroupMessage[]> {
  return loadMessages(channelId);
}

export function saveMessages(channelId: string, messages: GroupMessage[]): void {
  messageCache.set(channelId, messages);
  try { localStorage.setItem(lsMessagesKey(channelId), JSON.stringify(messages)); } catch { }
}

export function appendMessage(msg: GroupMessage): void {
  const current = messageCache.get(msg.channelId) ?? readMessagesFromLS(msg.channelId);
  const updated = [...current, msg];
  messageCache.set(msg.channelId, updated);
  try { localStorage.setItem(lsMessagesKey(msg.channelId), JSON.stringify(updated)); } catch { }
}

export function clearMessages(channelId: string): void {
  messageCache.delete(channelId);
  localStorage.removeItem(lsMessagesKey(channelId));
}
