import { agentDefinitionRepo, type CreateInput, type UpdateInput } from "@/lib/data";
import { invoke } from "@tauri-apps/api/core";
import { loadAgentCatalog, invalidateAgentCatalogCache, type CatalogAgent } from "@/lib/data/agent-loader";
import { loadChannels } from "@/lib/storage/group-chat.storage";
import { loadHiredAgentFiles, saveHiredAgentFiles } from "@/lib/storage";
import { useSkillStore } from "@/store";
import type { AgentDefinition, AgentInternalToolId, GroupChannel } from "@/types";
import { bridgeEnabledNiumaSkills } from "./skill-bridge";
import { catalogAgentAliases } from "./command-target";
import { expandNiumaSkillSlug } from "./skill-slugs";
import { resolvePresetSkillIds } from "./preset-skill-ids";
import { parseContentTeamManifest } from "@/lib/artifact/content-team-config";

export type WorkbenchTeamId = string;
export type WorkbenchTeamAccent = "rose" | "emerald" | "sky" | "violet" | "amber";

export interface WorkbenchTeamPreset {
  id: WorkbenchTeamId;
  name: string;
  legacyNames?: string[];
  eyebrow: string;
  description: string;
  avatar: string;
  accent: WorkbenchTeamAccent;
  kind: GroupChannel["kind"];
  commandDir?: string;
  agentFiles: string[];
  /** Agent filenames from a previous version that should be removed from hired set and channel. */
  legacyAgentFiles?: string[];
  skillSlugs: string[];
  starterPrompts: string[];
}

export const WORKBENCH_TEAM_PRESETS: WorkbenchTeamPreset[] = [
  {
    id: "content",
    name: "内容创作",
    eyebrow: "Markdown · 多平台",
    description: "编辑部。主理人 /article 管稿；采编选题；写手写 Markdown；主编审稿；配图师配图；发行 /format /publish。",
    avatar: "✍️",
    accent: "amber",
    kind: "chat",
    commandDir: "teams/content/commands",
    agentFiles: [
      "producer.md",
      "desk.md",
      "writer.md",
      "illustrator.md",
      "chief.md",
      "publisher.md",
    ],
    legacyAgentFiles: [
      "aria.md",
      "iris.md",
      "tina.md",
      "sam.md",
      "rose.md",
      "wechat-director.md",
      "wechat-researcher.md",
      "gzh-expert.md",
      "brand-advisor.md",
      "marketing.md",
      "video-director.md",
      "wechat-writer.md",
      "wechat-formatter.md",
      "wechat-reviewer.md",
      "wechat-publisher.md",
    ],
    skillSlugs: [
      "article-main",
      "article-topics",
      "article-writing",
      "article-review",
      "article-formatting-wechat",
      "article-formatting-xhs",
      "article-formatting-zhihu",
      "article-images",
      "article-publish-wechat",
      "article-publish-xhs",
      "article-publish-zhihu",
      "article-assets",
    ],
    starterPrompts: [
      "/article create 今天想做一篇什么",
      "/article edit",
      "/format WECHAT",
      "/publish WECHAT",
    ],
  },
  {
    id: "health",
    name: "健康",
    legacyNames: ["家庭健康团队", "家庭健康团队 - 健康", "健康团队", "WellAlly Health"],
    eyebrow: "个人 · 家庭 · 全生命周期",
    description: "个人与家庭健康管理频道。所有操作通过命令和技能完成，无复杂 UI。检查报告等附件上传至 IMA 健康知识库，日常记录与 AI 解读保存到本地数据库。",
    avatar: "❤️",
    accent: "emerald",
    kind: "chat",
    commandDir: "teams/health/commands",
    agentFiles: [
      "guide.md",
      "analyst.md",
      "nutritionist.md",
      "mental.md",
      "doctor.md",
    ],
    legacyAgentFiles: [
      "cardiology.md",
      "consultation-coordinator.md",
      "dermatology.md",
      "endocrinology.md",
      "gastroenterology.md",
      "general.md",
      "geriatrics.md",
      "gynecology.md",
      "hematology.md",
      "nephrology.md",
      "neurology.md",
      "oncology.md",
      "orthopedics.md",
      "pediatrics.md",
      "psychiatry.md",
      "respiratory.md",
      "urology.md",
    ],
    skillSlugs: ["ima-skill"],
    starterPrompts: [
      "/profile-v2 setup — 建立健康档案",
      "/record symptom 描述你的症状",
      "/analyze — 上传检查报告图片",
      "/report-v2 — 生成健康报告",
    ],
  },
  {
    id: "meeting",
    name: "会议",
    legacyNames: ["会议团队"],
    eyebrow: "准备 · 记录 · 跟进",
    description: "AI 驱动的全流程会议辅助助手。从会前准备、会中实时辅助到会后跟进，帮助团队提升会议质量。",
    avatar: "🎯",
    accent: "sky",
    kind: "meeting",
    agentFiles: ["facilitator.md", "noter.md", "summarizer.md", "tracker.md", "communicator.md"],
    legacyAgentFiles: ["assistant.md", "quinn.md", "frank.md", "kate.md"],
    commandDir: "teams/meeting/commands",
    skillSlugs: ["meetpoints", "meetactions", "meetquestions", "meetreply", "ima-skill"],
    starterPrompts: [
      "把这次会议整理成纪要和行动项",
      "根据会议内容提炼决策、风险和下一步",
      "生成会后给团队的同步消息",
    ],
  },  {
    id: "study",
    name: "学习",
    eyebrow: "语法 / 词汇 / 阅读 / 写作",
    description: "GPT-Tutor 语言学习频道。语法、词汇、阅读理解、句子分析和写作辅助一体化。",
    avatar: "📚",
    accent: "violet",
    kind: "chat",
    commandDir: "teams/study/commands",
    agentFiles: ["tutor.md", "grammar-coach.md", "vocab-coach.md", "reader.md", "writer.md"],
    skillSlugs: ["gt-grammar", "gt-vocab", "gt-reading", "gt-sentence", "gt-writing"],
    starterPrompts: [
      "gt-vocab analyze — 分析单词",
      "gt-grammar — 语法讲解与纠错",
      "gt-reading — 文章阅读理解",
    ],
  },];

export function getWorkbenchTeamPreset(
  channel: GroupChannel | null | undefined,
  presets: WorkbenchTeamPreset[] = WORKBENCH_TEAM_PRESETS,
) {
  if (!channel) return null;
  // Primary: explicit teamId binding
  if (channel.teamId) {
    return presets.find((p) => p.id === channel.teamId) ?? null;
  }
  // Fallback: legacy name-based matching for channels created before teamId existed
  const channelName = channel.name.trim();
  return presets.find(
    (preset) =>
      preset.name === channelName ||
      preset.legacyNames?.includes(channelName) ||
      (preset.id === "health" && channelName.includes("健康")),
  ) ?? null;
}

export function getWorkbenchTeamPresetById(
  id: WorkbenchTeamId,
  presets: WorkbenchTeamPreset[] = WORKBENCH_TEAM_PRESETS,
) {
  return presets.find((preset) => preset.id === id) ?? null;
}

export async function loadWorkbenchTeamPresets(): Promise<WorkbenchTeamPreset[]> {
  if (!isTauri()) return WORKBENCH_TEAM_PRESETS;

  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return WORKBENCH_TEAM_PRESETS;

  const separator = root.includes("/") ? "/" : "\\";

  // Load manifests for all hardcoded presets
  const knownIds = new Set(WORKBENCH_TEAM_PRESETS.map((p) => p.id));
  const presets = await Promise.all(
    WORKBENCH_TEAM_PRESETS.map(async (preset) => {
      const configPath = [root, ".niuma", "teams", preset.id, "config.yaml"].join(separator);
      const manifestPath = [root, ".niuma", "teams", preset.id, "TEAM.md"].join(separator);
      const configRaw = await invoke<string>("read_text_file", { path: configPath }).catch(() => "");
      if (configRaw) return applyTeamConfigYaml(preset, configRaw);
      const raw = await invoke<string>("read_text_file", { path: manifestPath }).catch(() => "");
      return raw ? applyTeamManifest(preset, raw) : preset;
    }),
  );

  // Discover additional teams from .niuma/teams/ not in hardcoded list
  try {
    const teamsDir = [root, ".niuma", "teams"].join(separator);
    const entries = await invoke<Array<{ path: string; is_directory: boolean }>>("list_directory", { path: teamsDir }).catch(() => [] as Array<{ path: string; is_directory: boolean }>);
    for (const entry of entries) {
      if (!entry.is_directory) continue;
      const slug = entry.path.split(/[\\/]/).pop() ?? "";
      if (!slug || knownIds.has(slug)) continue;
      const configPath = [entry.path, "config.yaml"].join(separator);
      const manifestPath = [entry.path, "TEAM.md"].join(separator);
      const configRaw = await invoke<string>("read_text_file", { path: configPath }).catch(() => "");
      const raw = configRaw || (await invoke<string>("read_text_file", { path: manifestPath }).catch(() => ""));
      if (!raw) continue;
      const apply = configRaw ? applyTeamConfigYaml : applyTeamManifest;
      const dynamic = apply(
        {
          id: slug,
          name: slug,
          eyebrow: "",
          description: "",
          avatar: "💬",
          accent: "violet" as WorkbenchTeamAccent,
          kind: "chat",
          agentFiles: [],
          skillSlugs: [],
          starterPrompts: [],
        },
        raw,
      );
      presets.push(dynamic);
      knownIds.add(slug);
    }
  } catch {
    // ignore discovery errors
  }

  return presets;
}

function applyTeamConfigYaml(preset: WorkbenchTeamPreset, raw: string): WorkbenchTeamPreset {
  const parsed = parseContentTeamManifest(raw);
  return {
    ...preset,
    name: parsed.name || preset.name,
    legacyNames: parsed.legacyNames.length > 0 ? parsed.legacyNames : preset.legacyNames,
    eyebrow: parsed.eyebrow || preset.eyebrow,
    description: parsed.description || preset.description,
    avatar: parsed.avatar || preset.avatar,
    accent: isWorkbenchTeamAccent(parsed.accent) ? parsed.accent : preset.accent,
    kind: parsed.kind === "meeting" ? "meeting" : parsed.kind === "chat" ? "chat" : preset.kind,
    commandDir: parsed.commandDir || preset.commandDir,
    agentFiles: parsed.agentFiles.length > 0 ? parsed.agentFiles.map(normalizeAgentFile) : preset.agentFiles,
    legacyAgentFiles: parsed.legacyAgentFiles.length > 0 ? parsed.legacyAgentFiles.map(normalizeAgentFile) : preset.legacyAgentFiles,
    skillSlugs: parsed.skillSlugs.length > 0 ? parsed.skillSlugs : preset.skillSlugs,
    starterPrompts: parsed.starterPrompts.length > 0 ? parsed.starterPrompts : preset.starterPrompts,
  };
}

function applyTeamManifest(preset: WorkbenchTeamPreset, raw: string): WorkbenchTeamPreset {
  const meta = parseTeamFrontmatter(raw);
  const agents = parseManifestList(raw, "Agents").map(normalizeAgentFile);
  const skills = parseManifestList(raw, "Skills");
  const commands = parseManifestList(raw, "Commands");
  const commandDir = meta.commandDir || commands[0]?.split("/")[0];

  return {
    ...preset,
    name: meta.name || preset.name,
    legacyNames: parseStringList(meta.legacyNames) ?? preset.legacyNames,
    eyebrow: meta.eyebrow || preset.eyebrow,
    description: meta.description || preset.description,
    avatar: meta.avatar || preset.avatar,
    accent: isWorkbenchTeamAccent(meta.accent) ? meta.accent : preset.accent,
    kind: meta.kind === "meeting" ? "meeting" : meta.kind === "chat" ? "chat" : preset.kind,
    commandDir: commandDir || preset.commandDir,
    agentFiles: agents.length > 0 ? agents : preset.agentFiles,
    skillSlugs: skills.length > 0 ? skills : preset.skillSlugs,
  };
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function parseTeamFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!item) continue;
    meta[item[1]] = item[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return meta;
}

function parseManifestList(raw: string, heading: string): string[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // No `m` flag so `$` matches end-of-string (not end-of-line), ensuring the
  // lazy quantifier captures all list items until the next section or EOF.
  const match = raw.match(new RegExp(`## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`));
  if (!match) return [];

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1]?.trim() ?? "")
    .filter(Boolean)
    .map((item) => item.replace(/`/g, ""));
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : undefined;
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function normalizeAgentFile(value: string): string {
  return value.endsWith(".md") ? value : `${value}.md`;
}

function isWorkbenchTeamAccent(value: string | undefined): value is WorkbenchTeamAccent {
  return value === "rose" || value === "emerald" || value === "sky" || value === "violet" || value === "amber";
}

export async function syncWorkbenchTeamChannel(
  preset: WorkbenchTeamPreset,
  options: {
    channel?: GroupChannel | null;
    createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>;
    updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>;
    editChannel?: (
      id: string,
      patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags">>,
    ) => void;
    refreshAgents: () => Promise<void>;
  },
): Promise<AgentDefinition[]> {
  if (typeof window === "undefined") return [];

  invalidateAgentCatalogCache();
  const catalog = await loadAgentCatalog();
  if (catalog.length === 0) return [];

  await bridgeEnabledNiumaSkills().catch(() => []);
  const skillsBySlug = getNiumaSkillIdsBySlug();

  const hiredFiles = loadHiredAgentFiles();
  for (const file of preset.agentFiles) hiredFiles.add(file);
  // Remove legacy agent files from hired set
  for (const file of preset.legacyAgentFiles ?? []) hiredFiles.delete(file);
  saveHiredAgentFiles(hiredFiles);

  let repoAgents = await agentDefinitionRepo.list();
  const updateRepoAgent = (agent: AgentDefinition) => {
    repoAgents = [agent, ...repoAgents.filter((item) => item.id !== agent.id)];
  };

  const members = await Promise.all(
    preset.agentFiles.map((file) =>
      ensurePresetAgent(preset.id, file, preset.skillSlugs, catalog, repoAgents, skillsBySlug, options.createAgent, options.updateAgent, updateRepoAgent),
    ),
  );
  const agents = members.filter((agent): agent is AgentDefinition => Boolean(agent));
  const agentIds = agents.map((agent) => agent.id);

  if (options.channel && options.editChannel && agentIds.length > 0) {
    const patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags">> = {};
    if (options.channel.avatar !== preset.avatar) patch.avatar = preset.avatar;
    if ((options.channel.kind ?? "chat") !== preset.kind) patch.kind = preset.kind;
    // When all preset agents are confirmed present, replace channel members with exactly
    // the preset's agents (removes unrelated or legacy agents). If not all agents are
    // ready yet (catalog cache miss), fall back to additive merge to avoid data loss.
    const allNewAgentsReady = agentIds.length >= preset.agentFiles.length;
    const targetAgentIds = allNewAgentsReady
      ? agentIds
      : unique([...options.channel.agentIds, ...agentIds]);
    if (!sameStringArray(options.channel.agentIds, targetAgentIds)) patch.agentIds = targetAgentIds;
    if (Object.keys(patch).length > 0) options.editChannel(options.channel.id, patch);
  }

  await options.refreshAgents();
  return agents;
}

function getNiumaSkillIdsBySlug() {
  const map = new Map<string, string>();
  for (const skill of useSkillStore.getState().items) {
    if (skill.sourceType !== "niuma" || !skill.source) continue;
    for (const slug of expandNiumaSkillSlug(skill.source)) {
      map.set(slug, skill.id);
    }
  }
  return map;
}

async function ensurePresetAgent(
  teamId: WorkbenchTeamId,
  file: string,
  skillSlugs: string[],
  catalog: CatalogAgent[],
  repoAgents: AgentDefinition[],
  skillsBySlug: Map<string, string>,
  createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>,
  updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>,
  updateRepoAgent: (agent: AgentDefinition) => void,
) {
  const teamAgentPath = `/.niuma/teams/${teamId}/agents/${file}`.replace(/\\/g, "/");
  const catalogAgent = catalog.find((agent) => agent.file === file && agent.sourcePath.replace(/\\/g, "/").endsWith(teamAgentPath))
    ?? catalog.find((agent) => agent.file === file);
  if (!catalogAgent) return null;

  const targetSkillIds = resolvePresetSkillIds(
    catalogAgent.enabledSkillIds,
    skillSlugs,
    skillsBySlug,
  );
  const workspacePath =
    teamId === "content"
      ? (await invoke<string>("get_niuma_root_dir").catch(() => "")) || catalogAgent.workspacePath || ""
      : catalogAgent.workspacePath || "";
  const existing = findAgentByCatalog(repoAgents, catalogAgent);

  if (!existing) {
    const created = await createAgent({
      name: catalogAgent.name,
      role: catalogAgent.role ?? "",
      avatar: catalogAgent.avatar ?? "",
      description: catalogAgent.description ?? "",
      systemPrompt: catalogAgent.systemPrompt ?? "",
      providerId: catalogAgent.providerId ?? "",
      modelId: catalogAgent.modelId ?? "",
      enabledInternalTools: (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[],
      enabledSkillIds: targetSkillIds,
      enabledMcpServerIds: catalogAgent.enabledMcpServerIds ?? [],
      sandboxMode: (catalogAgent.sandboxMode ?? "read-only") as AgentDefinition["sandboxMode"],
      temperature: catalogAgent.temperature ?? 0.7,
      maxTokens: catalogAgent.maxTokens ?? 2000,
      workspacePath,
    });
    updateRepoAgent(created);
    return created;
  }

  // Sync avatar: if the catalog resolved a talent_icon image but the stored
  // agent still carries an emoji or blank avatar, update it.
  const catalogAvatar = catalogAgent.avatar ?? "";
  const existingAvatar = existing.avatar ?? "";
  const catalogIsImage = catalogAvatar.startsWith("/") || catalogAvatar.startsWith("http") || catalogAvatar.startsWith("data:");
  const existingIsImage = existingAvatar.startsWith("/") || existingAvatar.startsWith("http") || existingAvatar.startsWith("data:");
  const needsAvatarSync = catalogAgent.fromTeams && catalogIsImage && !existingIsImage;

  const patch: UpdateInput<AgentDefinition> = {};
  if (!sameStringArray(existing.enabledSkillIds ?? [], targetSkillIds)) patch.enabledSkillIds = targetSkillIds;
  if (needsAvatarSync) patch.avatar = catalogAvatar;
  if (existing.name !== catalogAgent.name) patch.name = catalogAgent.name;
  if ((existing.role ?? "") !== (catalogAgent.role ?? "")) patch.role = catalogAgent.role ?? "";
  if (existing.description !== (catalogAgent.description ?? "")) patch.description = catalogAgent.description ?? "";
  if ((existing.systemPrompt ?? "") !== (catalogAgent.systemPrompt ?? "")) {
    patch.systemPrompt = catalogAgent.systemPrompt ?? "";
  }
  if (workspacePath && existing.workspacePath !== workspacePath) patch.workspacePath = workspacePath;
  if (
    !sameStringArray(
      existing.enabledInternalTools ?? [],
      (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[],
    )
  ) {
    patch.enabledInternalTools = (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[];
  }
  if (existing.sandboxMode !== (catalogAgent.sandboxMode ?? existing.sandboxMode)) {
    patch.sandboxMode = (catalogAgent.sandboxMode ?? existing.sandboxMode) as AgentDefinition["sandboxMode"];
  }

  if (Object.keys(patch).length > 0) {
    const updated = await updateAgent(existing.id, patch);
    if (updated) {
      updateRepoAgent(updated);
      return updated;
    }
  }
  return existing;
}

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export async function ensureWorkbenchDefaultTeams(options: {
  createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>;
  updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>;
  refreshAgents: () => Promise<void>;
  createChannel: (
    name: string,
    agentIds: string[],
    avatar?: string,
    kind?: GroupChannel["kind"],
    tags?: string[],
    teamId?: string,
  ) => GroupChannel;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const presets = await loadWorkbenchTeamPresets();
  const catalog = await loadAgentCatalog();
  if (catalog.length === 0) return false;

  await bridgeEnabledNiumaSkills().catch(() => []);
  const skillsBySlug = getNiumaSkillIdsBySlug();

  const hiredFiles = loadHiredAgentFiles();
  for (const preset of presets) {
    for (const file of preset.agentFiles) hiredFiles.add(file);
  }
  saveHiredAgentFiles(hiredFiles);

  let repoAgents = await agentDefinitionRepo.list();
  const updateRepoAgent = (agent: AgentDefinition) => {
    repoAgents = [agent, ...repoAgents.filter((item) => item.id !== agent.id)];
  };

  const existingChannels = loadChannels();
  // Primary check: a channel already bound to this teamId exists
  const boundTeamIds = new Set(existingChannels.map((c) => c.teamId).filter(Boolean));
  // Fallback: legacy channels created before teamId existed — match by name
  const existingNames = new Set(existingChannels.map((c) => c.name));
  let createdAny = false;

  for (const preset of [...presets].reverse()) {
    // Skip if any channel is already bound to this team
    if (boundTeamIds.has(preset.id)) continue;
    // Skip legacy name matches (channels created before teamId support)
    const legacyNames = preset.legacyNames ?? [];
    if (existingNames.has(preset.name) || legacyNames.some((name) => existingNames.has(name))) continue;

    const members = await Promise.all(
      preset.agentFiles.map((file) =>
        ensurePresetAgent(
          preset.id,
          file,
          preset.skillSlugs,
          catalog,
          repoAgents,
          skillsBySlug,
          options.createAgent,
          options.updateAgent,
          updateRepoAgent,
        ),
      ),
    );
    const agentIds = members.filter((agent): agent is AgentDefinition => Boolean(agent)).map((agent) => agent.id);
    if (agentIds.length === 0) continue;
    options.createChannel(preset.name, agentIds, preset.avatar, preset.kind, [], preset.id);
    createdAny = true;
  }

  await options.refreshAgents();
  return createdAny;
}

function findAgentByCatalog(agents: AgentDefinition[], catalogAgent: CatalogAgent) {
  const aliases = catalogAgentAliases(catalogAgent.file, catalogAgent.name, catalogAgent.role).map((value) =>
    value.trim().toLowerCase(),
  );
  return agents.find((agent) => {
    const name = agent.name.trim().toLowerCase();
    const role = (agent.role ?? "").trim().toLowerCase();
    return aliases.includes(name) || (role !== "" && aliases.includes(role));
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}