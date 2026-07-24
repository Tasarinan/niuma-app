/**
 * PI Framework slash commands integration for niuma-app.
 *
 * Provides unified slash command system supporting:
 * - PI built-in commands (/model, /settings, /session, /trust, /reload, etc.)
 * - Skill commands (/skill:name) — auto-registered from enabled skills
 * - Template commands (/template-name) — auto-registered from templates
 * - Custom commands — from .niuma/commands/*.md
 * - Extension commands — registered by custom extensions
 *
 * @example
 *   const commands = usePiSlashCommands(skills, templates, {
 *     switchModel: async (id) => { ... },
 *     openSettings: () => { ... }
 *   });
 *
 *   // Show suggestions on '/' input
 *   const suggestions = commands.getSuggestions('mod');
 *
 *   // Parse and execute
 *   const cmd = commands.parse('/model claude-opus');
 *   if (cmd) await commands.execute(cmd);
 */

export * from "./handler";
export * from "./use-pi-commands";
