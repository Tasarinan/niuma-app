/**
 * File-based memory for niuma agent teams.
 *
 * Inspired by pi-memory (github.com/yandy/pi-packages/tree/main/pi-memory).
 * Each team gets its own directory under .artifacts/memory/<teamId>/:
 *
 *   .artifacts/memory/<teamId>/
 *     MEMORY.md          — compact index: one line per topic file
 *     <topic>.md         — topic file with frontmatter + ## entries
 *     sessions/YYYYMMDD.md — conversation turns for that local day
 *
 * MEMORY.md is injected into every agent system prompt (snapshot semantics).
 * Topic files are loaded on demand via the `memory` tool.
 *
 * API surface (all operations go through Tauri invoke — no Node.js fs):
 *   readMemoryIndex(teamId)               → MEMORY.md string or ""
 *   readTopicFile(teamId, topic)          → topic markdown or ""
 *   listTopicFiles(teamId)                → string[] of filenames
 *   addMemoryEntry(teamId, opts)          → void
 *   searchMemory(teamId, query)           → matching entry blocks
 *   deleteMemoryEntry(teamId, title)      → void
 *   deleteAllTeamMemory(teamId)           → void
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getNiumaRoot(): Promise<string> {
  return invoke<string>("get_niuma_root_dir").catch(() => "");
}

function sep(root: string): string {
  return root.includes("/") ? "/" : "\\";
}

/** Folder name under `.artifacts/memory/`. Team ids are already slugs; strip path characters. */
export function memoryTeamSegment(teamId: string): string {
  const safe = teamId
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+/, "");
  return safe || "unknown";
}

export function memoryDir(root: string, teamId: string): string {
  const s = sep(root);
  return `${root}${s}.artifacts${s}memory${s}${memoryTeamSegment(teamId)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local calendar day, `YYYYMMDD`. */
export function sessionDayKey(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function sessionDayLabel(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function sessionClock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function sessionFilePath(root: string, teamId: string, date: Date): string {
  const s = sep(root);
  return `${memoryDir(root, teamId)}${s}sessions${s}${sessionDayKey(date)}.md`;
}

function indexPath(root: string, teamId: string): string {
  return `${memoryDir(root, teamId)}${sep(root)}MEMORY.md`;
}

function topicPath(root: string, teamId: string, topic: string): string {
  const safe = topic.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/\.md$/i, "");
  return `${memoryDir(root, teamId)}${sep(root)}${safe}.md`;
}

async function readFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path }).catch(() => "");
}

async function writeFile(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}

// ─── Index helpers ────────────────────────────────────────────────────────────

interface IndexEntry {
  topic: string; // filename without .md
  summary: string;
}

function parseIndex(raw: string): IndexEntry[] {
  return raw
    .split(/\r?\n/)
    .filter((l) => l.startsWith("- ["))
    .map((l) => {
      const m = l.match(/^- \[([^\]]+)\]\(([^)]+)\)\s*—\s*(.*)$/);
      if (!m) return null;
      return { topic: m[2].replace(/\.md$/, ""), summary: m[3] };
    })
    .filter((e): e is IndexEntry => e !== null);
}

function serializeIndex(entries: IndexEntry[]): string {
  if (entries.length === 0) return "# Memory Index\n\n_No entries yet._\n";
  const lines = entries.map(
    (e) => `- [${e.topic}](${e.topic}.md) — ${e.summary}`
  );
  return `# Memory Index\n\n${lines.join("\n")}\n`;
}

// ─── Topic file helpers ───────────────────────────────────────────────────────

export interface MemoryEntry {
  title: string;
  content: string;
}

function parseTopicEntries(raw: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  const blocks = raw.split(/^## /m).slice(1); // skip frontmatter / header
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    if (nl < 0) continue;
    const title = block.slice(0, nl).trim();
    const content = block.slice(nl + 1).trim();
    if (title) entries.push({ title, content });
  }
  return entries;
}

function buildTopicFile(
  topic: string,
  description: string,
  entries: MemoryEntry[]
): string {
  const now = new Date().toISOString().slice(0, 10);
  const front = `---\nname: ${topic}\ndescription: ${description}\ntype: feedback\nupdated: ${now}\n---\n\n`;
  const body = entries.map((e) => `## ${e.title}\n${e.content}`).join("\n\n");
  return front + body + "\n";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read MEMORY.md for a team (empty string when missing). */
export async function readMemoryIndex(teamId: string): Promise<string> {
  const root = await getNiumaRoot();
  if (!root) return "";
  return readFile(indexPath(root, teamId));
}

/** Read a single topic file (empty string when missing). */
export async function readTopicFile(
  teamId: string,
  topic: string
): Promise<string> {
  const root = await getNiumaRoot();
  if (!root) return "";
  return readFile(topicPath(root, teamId, topic));
}

/** List topic file names (without extension) for a team. */
export async function listTopicFiles(teamId: string): Promise<string[]> {
  const root = await getNiumaRoot();
  if (!root) return [];
  const raw = await readFile(indexPath(root, teamId));
  if (!raw) return [];
  return parseIndex(raw).map((e) => e.topic);
}

export interface AddMemoryOptions {
  topic: string;      // filename slug, e.g. "debugging"
  title: string;      // entry heading
  content: string;    // entry body
  description?: string; // topic-level description for auto-surfacing
}

/**
 * Append an entry to a topic file and update MEMORY.md.
 * Creates the topic file and MEMORY.md if they don't exist.
 */
export async function addMemoryEntry(
  teamId: string,
  opts: AddMemoryOptions
): Promise<void> {
  const root = await getNiumaRoot();
  if (!root) throw new Error("Cannot resolve niuma root directory");

  const { topic, title, content, description } = opts;

  // Read existing topic file
  const tPath = topicPath(root, teamId, topic);
  const existingRaw = await readFile(tPath);

  // Parse and append
  const entries = existingRaw ? parseTopicEntries(existingRaw) : [];
  // Remove old entry with same title if exists
  const filtered = entries.filter(
    (e) => e.title.toLowerCase() !== title.toLowerCase()
  );
  filtered.push({ title, content });

  // Derive description from first entry if not supplied
  const desc =
    description ||
    (filtered[0]?.content.slice(0, 80).replace(/\n/g, " ") ?? topic);

  const updatedTopic = buildTopicFile(topic, desc, filtered);
  await writeFile(tPath, updatedTopic);

  // Update MEMORY.md index
  const idxPath = indexPath(root, teamId);
  const existingIdx = await readFile(idxPath);
  const idxEntries = existingIdx ? parseIndex(existingIdx) : [];
  const hook = `${filtered.map((e) => e.title).slice(0, 3).join("; ")}`;
  const updatedIdx = [
    ...idxEntries.filter((e) => e.topic !== topic),
    { topic, summary: hook },
  ];
  await writeFile(idxPath, serializeIndex(updatedIdx));
}

/** Search topic files and dated session logs. */
export async function searchMemory(
  teamId: string,
  query: string
): Promise<MemoryEntry[]> {
  const root = await getNiumaRoot();
  if (!root) return [];
  const topics = await listTopicFiles(teamId);
  const q = query.toLowerCase();
  const results: MemoryEntry[] = [];
  for (const topic of topics) {
    const raw = await readFile(topicPath(root, teamId, topic));
    if (!raw) continue;
    for (const entry of parseTopicEntries(raw)) {
      if (
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q)
      ) {
        results.push({ title: `[${topic}] ${entry.title}`, content: entry.content });
      }
    }
  }
  const sessions = await listSessionFiles(teamId);
  for (const file of sessions) {
    const raw = await readSessionFile(teamId, file);
    if (!raw.toLowerCase().includes(q)) continue;
    const day = file.replace(/\.md$/i, "");
    const clipped = raw.length > 1200 ? `${raw.slice(0, 1200)}\n…` : raw;
    results.push({ title: `[会话 ${day}]`, content: clipped });
  }
  return results;
}

/** Delete an entry by title across all topic files. */
export async function deleteMemoryEntry(
  teamId: string,
  title: string
): Promise<void> {
  const root = await getNiumaRoot();
  if (!root) return;
  const topics = await listTopicFiles(teamId);
  const tLower = title.toLowerCase();
  for (const topic of topics) {
    const tPath = topicPath(root, teamId, topic);
    const raw = await readFile(tPath);
    if (!raw) continue;
    const entries = parseTopicEntries(raw);
    const filtered = entries.filter(
      (e) => e.title.toLowerCase() !== tLower
    );
    if (filtered.length === entries.length) continue;
    if (filtered.length === 0) {
      // Remove topic entirely from index
      const idxPath = indexPath(root, teamId);
      const idxRaw = await readFile(idxPath);
      const idxEntries = parseIndex(idxRaw).filter((e) => e.topic !== topic);
      await writeFile(idxPath, serializeIndex(idxEntries));
    } else {
      const desc = filtered[0]?.content.slice(0, 80).replace(/\n/g, " ") ?? topic;
      await writeFile(tPath, buildTopicFile(topic, desc, filtered));
      // Update index summary
      const idxPath = indexPath(root, teamId);
      const idxRaw = await readFile(idxPath);
      const idxEntries = parseIndex(idxRaw).map((e) =>
        e.topic === topic
          ? { topic, summary: filtered.map((x) => x.title).slice(0, 3).join("; ") }
          : e
      );
      await writeFile(idxPath, serializeIndex(idxEntries));
    }
    break;
  }
}

export interface SessionReply {
  agentName: string;
  content: string;
}

export interface SessionTurn {
  at?: Date;
  channelName: string;
  userText: string;
  replies: SessionReply[];
}

/** One turn inside a daily session file. */
export function formatSessionTurn(turn: SessionTurn): string {
  const at = turn.at ?? new Date();
  const channel = turn.channelName.trim() || "会话";
  const lines = [`## ${sessionClock(at)} · ${channel}`, "", "**用户**", turn.userText.trim() || "（空消息）", ""];
  for (const reply of turn.replies) {
    const name = reply.agentName.trim() || "坐席";
    const body = reply.content.trim();
    if (!body) continue;
    lines.push(`**${name}**`, body, "");
  }
  return lines.join("\n").replace(/\n+$/, "");
}

/** Append a turn to the day's markdown. Creates the day heading when the file is empty. */
export function mergeSessionLog(existing: string, dayLabel: string, block: string): string {
  const trimmed = existing.trim();
  if (!trimmed) return `# ${dayLabel}\n\n${block}\n`;
  return `${trimmed}\n\n${block}\n`;
}

/**
 * Append this turn to `.artifacts/memory/<teamId>/sessions/YYYYMMDD.md`.
 * The date is the local calendar day of `turn.at`.
 */
export async function appendTeamSession(teamId: string, turn: SessionTurn): Promise<void> {
  const root = await getNiumaRoot();
  if (!root || !teamId.trim()) return;
  const at = turn.at ?? new Date();
  const path = sessionFilePath(root, teamId, at);
  const existing = await readFile(path);
  await writeFile(path, mergeSessionLog(existing, sessionDayLabel(at), formatSessionTurn({ ...turn, at })));
}

/** Session day filenames (`YYYYMMDD.md`), newest first. */
export async function listSessionFiles(teamId: string): Promise<string[]> {
  const root = await getNiumaRoot();
  if (!root || !teamId.trim()) return [];
  const dir = `${memoryDir(root, teamId)}${sep(root)}sessions`;
  const entries = await invoke<Array<{ name: string; isDir: boolean }>>("list_directory", { path: dir }).catch(
    () => [] as Array<{ name: string; isDir: boolean }>,
  );
  return entries
    .filter((entry) => !entry.isDir && /^\d{8}\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
}

export async function readSessionFile(teamId: string, fileName: string): Promise<string> {
  const root = await getNiumaRoot();
  if (!root || !/^\d{8}\.md$/i.test(fileName)) return "";
  const path = `${memoryDir(root, teamId)}${sep(root)}sessions${sep(root)}${fileName}`;
  return readFile(path);
}

/** Clear all memory for a team. */
export async function deleteAllTeamMemory(teamId: string): Promise<void> {
  const root = await getNiumaRoot();
  if (!root) return;
  // Overwrite MEMORY.md with empty
  await writeFile(indexPath(root, teamId), serializeIndex([]));
  // Note: topic files are left but index no longer points to them.
  // A future /dream-style consolidation could prune them.
}

/**
 * Build the system-prompt snippet for a team.
 * Injects MEMORY.md index so agents know what topics exist.
 * maxChars caps the injected content (default 6000 chars ≈ 1500 tokens).
 */
export async function buildMemorySystemPromptSnippet(
  teamId: string,
  maxChars = 6000
): Promise<string> {
  const index = await readMemoryIndex(teamId);
  if (!index || index.includes("_No entries yet._")) return "";
  const truncated = index.length > maxChars
    ? index.slice(0, maxChars) + "\n[truncated]"
    : index;
  return `\n\n---\n## Team Memory (${teamId})\n${truncated}\n---`;
}
