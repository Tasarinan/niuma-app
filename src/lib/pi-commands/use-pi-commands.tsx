/**
 * Hook to integrate PI slash commands into niuma-app's completion UI.
 *
 * Usage:
 *   const commands = usePiSlashCommands(skills, templates, callbacks);
 *   // In input handler: show suggestions when user types '/'
 *   // On Enter: execute matched command or inject into agent prompt
 */

import { useEffect, useState, useCallback } from "react";
import type { Skill } from "@/types";
import type { PromptTemplate } from "./handler";
import {
  createSlashCommandRegistry,
  createBuiltinCommandHandlers,
  registerSkillCommands,
  registerTemplateCommands,
  parseSlashCommand,
  getCommandSuggestions,
  type SlashCommandRegistry,
  type ParsedCommand,
  type CommandHandler,
} from "./handler";

export interface PiCommandCallbacks {
  switchModel?: (modelId: string) => Promise<void>;
  openSettings?: () => void;
  showSession?: () => void;
  trustProject?: () => Promise<void>;
  reload?: () => void;
  onSkillSelected?: (skillName: string) => void;
  onTemplateSelected?: (templateContent: string) => void;
}

export interface UsePiSlashCommandsResult {
  registry: SlashCommandRegistry;
  suggestions: CommandHandler[];
  parse: (input: string) => ParsedCommand | null;
  execute: (cmd: ParsedCommand) => Promise<void>;
  getSuggestions: (prefix: string) => CommandHandler[];
  refreshSkillsAndTemplates: (skills: Skill[], templates: PromptTemplate[]) => void;
}

export const usePiSlashCommands = (
  skills: Skill[],
  templates: PromptTemplate[],
  callbacks: PiCommandCallbacks
): UsePiSlashCommandsResult => {
  const [registry] = useState(() => createSlashCommandRegistry());
  const [suggestions, setSuggestions] = useState<CommandHandler[]>([]);

  // Initialize built-in commands
  useEffect(() => {
    const builtins = createBuiltinCommandHandlers(callbacks);
    for (const [name, handler] of builtins) {
      registry.register(name, handler);
    }
  }, [registry, callbacks]);

  // Register skill and template commands
  const refreshSkillsAndTemplates = useCallback(
    (updatedSkills: Skill[], updatedTemplates: PromptTemplate[]) => {
      // Clear previous skill/template commands
      registry.list().forEach((h) => {
        if (h.category === "skill" || h.category === "template") {
          registry.unregister(h.name);
        }
      });

      // Re-register with updated data
      registerSkillCommands(registry, updatedSkills);
      registerTemplateCommands(registry, updatedTemplates);
      setSuggestions(registry.list());
    },
    [registry]
  );

  // Initial load
  useEffect(() => {
    refreshSkillsAndTemplates(skills, templates);
  }, [skills, templates, refreshSkillsAndTemplates]);

  const parse = useCallback((input: string): ParsedCommand | null => {
    return parseSlashCommand(input);
  }, []);

  const execute = useCallback(
    async (cmd: ParsedCommand) => {
      const handler = registry.get(cmd.name);
      if (!handler) {
        console.warn(`[PI-CMD] Unknown command: ${cmd.name}`);
        return;
      }

      try {
        await handler.execute(cmd.args);

        // Trigger callback if available
        if (handler.category === "skill") {
          callbacks.onSkillSelected?.(cmd.name);
        } else if (handler.category === "template") {
          const template = templates.find((t) => t.name.toLowerCase() === cmd.name);
          if (template) {
            callbacks.onTemplateSelected?.(template.content);
          }
        }
      } catch (err) {
        console.error(`[PI-CMD] Execution failed for /${cmd.name}:`, err);
      }
    },
    [registry, templates, callbacks]
  );

  const getSuggestions = useCallback(
    (prefix: string) => {
      return getCommandSuggestions(registry, prefix);
    },
    [registry]
  );

  return {
    registry,
    suggestions,
    parse,
    execute,
    getSuggestions,
    refreshSkillsAndTemplates,
  };
};

// ─── UI Component for Command Suggestions ─────────────────────────────────────

interface CommandSuggestionProps {
  commands: CommandHandler[];
  onSelect: (cmd: CommandHandler) => void;
}

export const CommandSuggestionList: React.FC<CommandSuggestionProps> = ({
  commands,
  onSelect,
}) => {
  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
      {commands.map((cmd) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium text-sm">
                /{cmd.name}
                <span className="ml-2 text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  {cmd.category}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{cmd.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
