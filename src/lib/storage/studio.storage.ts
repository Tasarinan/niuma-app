/**
 * localStorage-backed persistence for Studio projects and their message
 * threads. Mirrors the group-chat storage shape but is namespaced separately
 * so creation projects never mix with chat channels.
 */

import type { StudioProject, StudioMessage } from "@/types";

const PROJECTS_KEY = "niuma:studio-projects";
const messagesKey = (projectId: string) => `niuma:studio-messages:${projectId}`;

// ─── Projects ───────────────────────────────────────────────────────────────

export function loadProjects(): StudioProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as StudioProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: StudioProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(
  name: string,
  agentIds: string[],
  avatar = "🎨"
): StudioProject {
  const now = new Date().toISOString();
  const project: StudioProject = {
    id: crypto.randomUUID(),
    name,
    avatar,
    agentIds,
    createdAt: now,
    updatedAt: now,
  };
  saveProjects([project, ...loadProjects()]);
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<Pick<StudioProject, "name" | "avatar" | "agentIds">>
): void {
  const projects = loadProjects().map((p) =>
    p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
  );
  saveProjects(projects);
}

export function deleteProject(id: string): void {
  saveProjects(loadProjects().filter((p) => p.id !== id));
  localStorage.removeItem(messagesKey(id));
}

// ─── Messages ───────────────────────────────────────────────────────────────

export function loadMessages(projectId: string): StudioMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(projectId));
    return raw ? (JSON.parse(raw) as StudioMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(projectId: string, messages: StudioMessage[]): void {
  localStorage.setItem(messagesKey(projectId), JSON.stringify(messages));
}

export function appendMessage(msg: StudioMessage): void {
  saveMessages(msg.projectId, [...loadMessages(msg.projectId), msg]);
}

export function clearMessages(projectId: string): void {
  localStorage.removeItem(messagesKey(projectId));
}
