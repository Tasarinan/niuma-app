import {
  KnowledgeProfile,
  MeetingSummary,
  KnowledgeEntity,
} from "@/types";
import {
  getKnowledgeProfile,
  getRecentMeetingSummaries,
  getTopKnowledgeEntities,
} from "@/lib/database";
import { safeLocalStorage, getUserIdentity, hasUserIdentity } from "@/lib";
import { STORAGE_KEYS } from "@/config";

// Token budget constants (approximate - 1 token ≈ 4 chars)
const DEFAULT_MAX_TOKENS = 1500;
const CHARS_PER_TOKEN = 4;

// Cache for context to avoid rebuilding on every request
let cachedContext: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Estimates token count from text (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncates text to fit within token budget
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars - 3) + "...";
}

/**
 * Gets the context memory settings from localStorage
 */
export function getContextMemorySettings(): {
  enabled: boolean;
  maxTokens: number;
  days: number;
} {
  const enabled = safeLocalStorage.getItem(STORAGE_KEYS.CONTEXT_MEMORY_ENABLED);
  const maxTokens = safeLocalStorage.getItem(STORAGE_KEYS.CONTEXT_MEMORY_MAX_TOKENS);
  const days = safeLocalStorage.getItem(STORAGE_KEYS.CONTEXT_MEMORY_DAYS);

  return {
    enabled: enabled !== "false", // Default to true
    maxTokens: maxTokens ? parseInt(maxTokens, 10) : DEFAULT_MAX_TOKENS,
    days: days ? parseInt(days, 10) : 30,
  };
}

/**
 * Saves context memory settings to localStorage
 */
export function setContextMemorySettings(settings: {
  enabled?: boolean;
  maxTokens?: number;
  days?: number;
}): void {
  if (settings.enabled !== undefined) {
    safeLocalStorage.setItem(
      STORAGE_KEYS.CONTEXT_MEMORY_ENABLED,
      String(settings.enabled)
    );
  }
  if (settings.maxTokens !== undefined) {
    safeLocalStorage.setItem(
      STORAGE_KEYS.CONTEXT_MEMORY_MAX_TOKENS,
      String(settings.maxTokens)
    );
  }
  if (settings.days !== undefined) {
    safeLocalStorage.setItem(
      STORAGE_KEYS.CONTEXT_MEMORY_DAYS,
      String(settings.days)
    );
  }
  // Invalidate cache when settings change
  invalidateContextCache();
}

/**
 * Invalidates the context cache
 */
export function invalidateContextCache(): void {
  cachedContext = null;
  cacheTimestamp = 0;
}

/**
 * Formats the knowledge profile section
 */
function formatProfileSection(profile: KnowledgeProfile): string {
  const parts: string[] = [];

  if (profile.summary) {
    parts.push(`**Background:** ${profile.summary}`);
  }

  if (profile.keyPeople.length > 0) {
    const people = profile.keyPeople
      .slice(0, 5) // Limit to top 5 for brevity
      .map((p) => `- ${p.name}: ${p.role}${p.relationship ? ` (${p.relationship})` : ""}`)
      .join("\n");
    parts.push(`**Key People:**\n${people}`);
  }

  if (profile.keyProjects.length > 0) {
    const projects = profile.keyProjects
      .filter((p) => p.status !== "completed") // Focus on active projects
      .slice(0, 5)
      .map((p) => `- ${p.name} [${p.status}]: ${p.description}`)
      .join("\n");
    if (projects) {
      parts.push(`**Active Projects:**\n${projects}`);
    }
  }

  if (profile.terminology.length > 0) {
    const terms = profile.terminology
      .slice(0, 5)
      .map((t) => `- ${t.term}: ${t.meaning}`)
      .join("\n");
    parts.push(`**Domain Terms:**\n${terms}`);
  }

  if (profile.recentGoals && profile.recentGoals.length > 0) {
    const goals = profile.recentGoals
      .slice(0, 5) // Limit to top 5
      .map((g) => `- ${g}`)
      .join("\n");
    parts.push(`**Recent Goals:**\n${goals}`);
  }

  if (profile.recentDecisions && profile.recentDecisions.length > 0) {
    const decisions = profile.recentDecisions
      .slice(0, 5)
      .map((d) => `- ${d}`)
      .join("\n");
    parts.push(`**Recent Decisions:**\n${decisions}`);
  }

  if (profile.recentTeamUpdates && profile.recentTeamUpdates.length > 0) {
    const updates = profile.recentTeamUpdates
      .slice(0, 5)
      .map((u) => `- ${u}`)
      .join("\n");
    parts.push(`**Recent Team Updates:**\n${updates}`);
  }

  return parts.join("\n\n");
}

/**
 * Formats recent summaries section
 */
function formatRecentSummaries(
  summaries: MeetingSummary[],
  maxTokens: number
): string {
  if (summaries.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let currentTokens = 0;

  for (const summary of summaries) {
    const date = new Date(summary.createdAt).toLocaleDateString();

    // Start with date and optional title
    let text = `[${date}]`;
    if (summary.title) {
      text += ` ${summary.title}:`;
    }
    text += ` ${summary.summary}`;

    // Add goals if they exist
    if (summary.goals && summary.goals.length > 0) {
      text += ` (Goals: ${summary.goals.slice(0, 2).join(", ")})`;
    }

    // Add next steps if they exist
    if (summary.nextSteps && summary.nextSteps.length > 0) {
      text += ` (Next: ${summary.nextSteps.slice(0, 2).join(", ")})`;
    }

    // Add topics if they exist
    if (summary.topics.length > 0) {
      text += ` (Topics: ${summary.topics.slice(0, 3).join(", ")})`;
    }

    const textTokens = estimateTokens(text);
    if (currentTokens + textTokens > maxTokens) {
      break;
    }

    parts.push(text);
    currentTokens += textTokens;
  }

  if (parts.length === 0) {
    return "";
  }

  return `**Recent Conversations:**\n${parts.join("\n")}`;
}

/**
 * Formats top entities section
 */
function formatTopEntities(entities: KnowledgeEntity[]): string {
  if (entities.length === 0) {
    return "";
  }

  // Group by type
  const byType: Record<string, KnowledgeEntity[]> = {};
  for (const entity of entities) {
    if (!byType[entity.entityType]) {
      byType[entity.entityType] = [];
    }
    byType[entity.entityType].push(entity);
  }

  const parts: string[] = [];

  // Add people
  if (byType.person && byType.person.length > 0) {
    const people = byType.person
      .slice(0, 5)
      .map((e) => e.name + (e.description ? ` (${e.description})` : ""))
      .join(", ");
    parts.push(`People: ${people}`);
  }

  // Add projects
  if (byType.project && byType.project.length > 0) {
    const projects = byType.project
      .slice(0, 5)
      .map((e) => e.name)
      .join(", ");
    parts.push(`Projects: ${projects}`);
  }

  // Add companies
  if (byType.company && byType.company.length > 0) {
    const companies = byType.company
      .slice(0, 3)
      .map((e) => e.name)
      .join(", ");
    parts.push(`Companies: ${companies}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `**Frequently Mentioned:**\n${parts.join("\n")}`;
}

/**
 * Builds the full context string to inject into AI prompts
 */
export async function buildContextString(): Promise<string> {
  const settings = getContextMemorySettings();

  // Check if context memory is enabled
  if (!settings.enabled) {
    return "";
  }

  // Check cache
  const now = Date.now();
  if (cachedContext !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedContext;
  }

  try {
    const sections: string[] = [];
    let remainingTokens = settings.maxTokens;

    // 1. Get and format knowledge profile (~500 tokens budget)
    const profile = await getKnowledgeProfile();
    if (profile && profile.summary) {
      const profileSection = formatProfileSection(profile);
      const profileTokens = estimateTokens(profileSection);
      if (profileTokens <= 500) {
        sections.push(profileSection);
        remainingTokens -= profileTokens;
      } else {
        sections.push(truncateToTokens(profileSection, 500));
        remainingTokens -= 500;
      }
    }

    // 2. Get and format recent summaries (~800 tokens budget)
    const daysAgo = Date.now() - settings.days * 24 * 60 * 60 * 1000;
    const summaries = await getRecentMeetingSummaries(20, daysAgo);
    if (summaries.length > 0) {
      const summaryBudget = Math.min(remainingTokens - 200, 800);
      const summarySection = formatRecentSummaries(summaries, summaryBudget);
      if (summarySection) {
        sections.push(summarySection);
        remainingTokens -= estimateTokens(summarySection);
      }
    }

    // 3. Get and format top entities (~200 tokens budget)
    const entities = await getTopKnowledgeEntities(15);
    if (entities.length > 0) {
      const entitiesSection = formatTopEntities(entities);
      if (entitiesSection) {
        const entitiesTokens = estimateTokens(entitiesSection);
        if (entitiesTokens <= remainingTokens) {
          sections.push(entitiesSection);
        }
      }
    }

    // Build final context
    if (sections.length === 0 && !hasUserIdentity()) {
      cachedContext = "";
      cacheTimestamp = now;
      return "";
    }

    // Build user identity section if configured
    let userIdentitySection = "";
    if (hasUserIdentity()) {
      const identity = getUserIdentity();
      if (identity) {
        userIdentitySection = `## About You (The User)

Your name is: ${identity.name}
Your role: ${identity.role}

`;
      }
    }

    const context = `${userIdentitySection}## Context About the User

${sections.join("\n\n")}

---

`;

    cachedContext = context;
    cacheTimestamp = now;

    return context;
  } catch (error) {
    console.error("Error building context string:", error);
    return "";
  }
}

/**
 * Gets context for injection (main entry point)
 * Returns empty string if disabled or no context available
 */
export async function getContextForInjection(): Promise<string> {
  return buildContextString();
}
