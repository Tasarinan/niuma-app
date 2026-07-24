/**
 * PI Framework slash command handler.
 *
 * Routes slash commands to appropriate handlers:
 * 1. PI built-in: /model, /settings, /session, /trust, /login, /logout, /reload
 * 2. Skill commands: /skill:name (auto-registered from enabled skills)
 * 3. Template commands: /template-name (from prompt templates)
 * 4. Custom commands: /.niuma/commands/*.md
 * 5. Extension commands: registered by extensions
 */

import type { Skill } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommandHandler {
  name: string;
  category: "builtin" | "skill" | "template" | "custom" | "extension";
  description: string;
  args?: { name: string; description: string; required: boolean }[];
  execute: (args: Record<string, unknown>) => Promise<void> | void;
}

export interface SlashCommandRegistry {
  handlers: Map<string, CommandHandler>;
  register(name: string, handler: CommandHandler): void;
  unregister(name: string): void;
  get(name: string): CommandHandler | undefined;
  list(): CommandHandler[];
  listByCategory(cat: "builtin" | "skill" | "template" | "custom" | "extension"): CommandHandler[];
}

// ─── Built-in PI Commands ─────────────────────────────────────────────────────

export const createBuiltinCommandHandlers = (callbacks: {
  switchModel?: (modelId: string) => Promise<void>;
  openSettings?: () => void;
  showSession?: () => void;
  trustProject?: () => Promise<void>;
  reload?: () => void;
}): Map<string, CommandHandler> => {
  const handlers = new Map<string, CommandHandler>();

  handlers.set("model", {
    name: "model",
    category: "builtin",
    description: "Switch AI model",
    args: [{ name: "model", description: "Model ID or pattern", required: true }],
    execute: async (args) => {
      const modelId = args.model as string;
      await callbacks.switchModel?.(modelId);
    },
  });

  handlers.set("settings", {
    name: "settings",
    category: "builtin",
    description: "Open settings panel",
    execute: () => callbacks.openSettings?.(),
  });

  handlers.set("session", {
    name: "session",
    category: "builtin",
    description: "Show current session info",
    execute: () => callbacks.showSession?.(),
  });

  handlers.set("trust", {
    name: "trust",
    category: "builtin",
    description: "Trust current project",
    execute: async () => await callbacks.trustProject?.(),
  });

  handlers.set("reload", {
    name: "reload",
    category: "builtin",
    description: "Reload skills, templates, and extensions",
    execute: () => callbacks.reload?.(),
  });

  handlers.set("login", {
    name: "login",
    category: "builtin",
    description: "Manage credentials",
    execute: () => {}, // Placeholder
  });

  handlers.set("logout", {
    name: "logout",
    category: "builtin",
    description: "Sign out",
    execute: () => {}, // Placeholder
  });

  return handlers;
};

// ─── Skill Command Registration ────────────────────────────────────────────────

export const registerSkillCommands = (
  registry: SlashCommandRegistry,
  skills: Skill[]
): void => {
  for (const skill of skills) {
    if (skill.enabled === false) continue;

    const skillName = (skill.name || skill.id).toLowerCase();
    const handlerName = `skill:${skillName}`;

    registry.register(handlerName, {
      name: skillName,
      category: "skill",
      description: skill.description || `Load skill: ${skill.name}`,
      execute: async () => {
        // Trigger load_skill tool via agent runtime
        console.log(`[PI-CMD] Load skill: ${skillName}`);
      },
    });
  }
};

// ─── Template Command Registration ────────────────────────────────────────────

export interface PromptTemplate {
  name: string;
  description?: string;
  content: string;
}

export const registerTemplateCommands = (
  registry: SlashCommandRegistry,
  templates: PromptTemplate[]
): void => {
  for (const template of templates) {
    const templateName = template.name.toLowerCase();

    registry.register(templateName, {
      name: templateName,
      category: "template",
      description: template.description || `Insert template: ${template.name}`,
      execute: () => {
        console.log(`[PI-CMD] Insert template: ${templateName}`);
      },
    });
  }
};

// ─── Registry Factory ─────────────────────────────────────────────────────────

export const createSlashCommandRegistry = (): SlashCommandRegistry => {
  const handlers = new Map<string, CommandHandler>();

  return {
    handlers,

    register(name: string, handler: CommandHandler) {
      handlers.set(name.toLowerCase(), handler);
    },

    unregister(name: string) {
      handlers.delete(name.toLowerCase());
    },

    get(name: string) {
      return handlers.get(name.toLowerCase());
    },

    list() {
      return Array.from(handlers.values());
    },

    listByCategory(cat) {
      return Array.from(handlers.values()).filter((h) => h.category === cat);
    },
  };
};

// ─── Command Parser ───────────────────────────────────────────────────────────

export interface ParsedCommand {
  name: string;
  args: Record<string, string>;
  raw: string;
}

export const parseSlashCommand = (input: string): ParsedCommand | null => {
  if (!input.startsWith("/")) return null;

  const parts = input.slice(1).split(/\s+/);
  const name = parts[0];
  const argsStr = parts.slice(1).join(" ");

  // Simple key=value or space-separated args
  const args: Record<string, string> = {};
  const argPairs = argsStr.match(/(\w+)=([^\s]+)|([^\s]+)/g) || [];

  for (const pair of argPairs) {
    if (pair.includes("=")) {
      const [k, v] = pair.split("=");
      args[k] = v;
    } else {
      args.value = pair;
    }
  }

  return { name, args, raw: input };
};

// ─── Suggestion Provider ──────────────────────────────────────────────────────

export const getCommandSuggestions = (
  registry: SlashCommandRegistry,
  prefix: string
): CommandHandler[] => {
  const lowerPrefix = prefix.toLowerCase();
  return registry
    .list()
    .filter((h) => h.name.startsWith(lowerPrefix))
    .sort((a, b) => a.name.localeCompare(b.name));
};
