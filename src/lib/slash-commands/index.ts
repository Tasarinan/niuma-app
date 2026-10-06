/**
 * Slash commands follow the Claude Code / Cursor markdown format.
 *
 * ```md
 * ---
 * description: Review a pull request
 * argument-hint: [pr-number] [priority]
 * allowed-tools: Read, Bash(gh pr view:*)
 * ---
 * Review PR #$0 with priority $1.
 * ```
 *
 * Filename is the command name. Placeholders: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$0`.
 * If the body has no `$ARGUMENTS`/`$N`, leftover args are appended as `ARGUMENTS:`.
 * Who runs the command comes from team `config.yaml` `roles[].commands`, not frontmatter.
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
  choices: CommandArgumentChoice[];
}

export interface CommandArgumentChoice {
  value: string;
  description: string;
}

export interface SlashArgumentCompletion {
  command: SlashCommandDefinition;
  argument: CommandArgument;
  argumentIndex: number;
  prefix: string;
  choices: CommandArgumentChoice[];
}

export interface SlashCommandDefinition {
  /** Command name without the leading slash, e.g. "profile" */
  name: string;
  /** Source type used for invocation handling and display */
  source: "file" | "extension";
  /** UI source label for suggestion rendering */
  sourceLabel: "file" | "extension" | "builtin";
  /** Absolute path to the command markdown file */
  path: string;
  /** Short description from frontmatter */
  description: string;
  /** Optional argument hint, e.g. "<name> [args]" */
  argumentHint?: string;
  /** Parsed argument specs from frontmatter */
  arguments: CommandArgument[];
  /** Full raw markdown content including frontmatter */
  content: string;
  /** Agent name (Chinese or English) that should handle this command exclusively */
  agent?: string;
  /** When true, omit from the slash suggestion menu; typed invocation still works. */
  hidden?: boolean;
}

export interface SlashCommandExtension {
  /** Command name without leading slash */
  name: string;
  /** Short description shown in suggestion menu */
  description: string;
  /** Optional usage hint, e.g. "<name> [args]" */
  argumentHint?: string;
  /** Marks this as a built-in extension command. */
  builtin?: boolean;
  /**
   * Returns slash resolution that should be handled by UI/runtime.
   * Return null to indicate the command should fall back to raw input.
   */
  handler: (
    args: string,
    context: { commands: SlashCommandDefinition[] }
  ) => SlashCommandResolution | null;
}

export type SlashCommandResolution =
  | { kind: "prompt"; text: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const slashCommandExtensions = new Map<string, SlashCommandExtension>();
let defaultExtensionsRegistered = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return meta;
}

function cleanFrontmatterValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function stripCommandFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/** Turn Claude/Cursor `argument-hint: [create|edit] [target]` into completion specs. */
export function parseArgumentHint(hint: string): CommandArgument[] {
  const trimmed = hint.trim();
  if (!trimmed) return [];
  const tokens = trimmed.match(/\[[^\]]+\]|<[^>]+>|[^\s]+/g) ?? [];
  return tokens.map((token, index) => {
    const inner = token.replace(/^\[|\]$/g, "").replace(/^<|>$/g, "").trim();
    const parts = inner.split(/[|/]/).map((part) => part.trim()).filter(Boolean);
    const identParts = parts.filter((part) => /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(part));
    const choices =
      identParts.length >= 2
        ? identParts.map((value) => ({ value, description: "" }))
        : inferArgumentChoices(inner);
    const name =
      identParts.length === 1
        ? identParts[0]
        : identParts.length >= 2
          ? index === 0
            ? "action"
            : `arg${index}`
          : inner.replace(/[^A-Za-z0-9_-]+/g, "") || `arg${index}`;
    return {
      name,
      description: inner,
      required: !token.startsWith("[") || index === 0,
      choices,
    };
  });
}

/** Claude/Cursor placeholders: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$0`. */
export function expandCommandPlaceholders(body: string, args: string): string {
  const trimmedArgs = args.trim();
  const tokens = trimmedArgs ? trimmedArgs.split(/\s+/) : [];
  const hasPlaceholder = /\$ARGUMENTS(?:\[\d+\])?/.test(body) || /\$\d+\b/.test(body);
  let out = body.replace(/\$ARGUMENTS\[(\d+)\]/g, (_match, index: string) => tokens[Number(index)] ?? "");
  out = out.replace(/\$ARGUMENTS/g, trimmedArgs);
  out = out.replace(/\$(\d+)\b/g, (_match, index: string) => tokens[Number(index)] ?? "");
  if (!hasPlaceholder && trimmedArgs) {
    out = `${out.trimEnd()}\n\nARGUMENTS: ${trimmedArgs}`;
  }
  return out;
}

/** Infer `value(description)` or comma-separated enum values from descriptions. */
export function inferArgumentChoices(description: string): CommandArgumentChoice[] {
  const normalized = description.replace(/（/g, "(").replace(/）/g, ")");
  let candidate = normalized.includes(":") || normalized.includes("：")
    ? normalized.split(/[:：]/).slice(1).join(":")
    : normalized;

  const parenthesizedList = candidate.match(/\(([^()]*(?:[,，][^()]*)+)\)/);
  if (!candidate.includes("/") && parenthesizedList) {
    candidate = parenthesizedList[1];
  }

  const separator = candidate.includes("/") ? /\// : /[,，]/;
  const parts = candidate.split(separator).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return [];

  const choices = parts.flatMap((part) => {
    const wrapped = part.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)(?:\(([^()]*)\))?$/);
    if (wrapped) {
      return [{ value: wrapped[1], description: wrapped[2]?.trim() ?? "" }];
    }

    const assigned = part.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)\s*=\s*(.+)$/);
    if (assigned) {
      return [{ value: assigned[1], description: assigned[2].trim() }];
    }

    const compact = part.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)([^A-Za-z0-9].+)$/);
    if (compact) {
      return [{ value: compact[1], description: compact[2].trim() }];
    }

    return [];
  });

  return choices.length >= 2 ? choices : [];
}

/** Parse the simple YAML argument list used by `.niuma/commands/*.md`. */
export function parseCommandArguments(raw: string): CommandArgument[] {
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return [];

  const lines = frontmatter[1].split(/\r?\n/);
  const start = lines.findIndex((line) => /^arguments\s*:/.test(line));
  if (start === -1 || /^arguments\s*:\s*\[\s*\]\s*$/.test(lines[start])) return [];

  const result: CommandArgument[] = [];
  let current: CommandArgument | null = null;

  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;

    const item = line.match(/^\s*-\s+name\s*:\s*(.*)$/);
    if (item) {
      if (current?.name) result.push(current);
      current = {
        name: cleanFrontmatterValue(item[1]),
        description: "",
        required: false,
        choices: [],
      };
      continue;
    }

    if (!current) continue;
    const property = line.match(/^\s+(name|description|required)\s*:\s*(.*)$/);
    if (!property) continue;
    const value = cleanFrontmatterValue(property[2]);
    if (property[1] === "name") current.name = value;
    if (property[1] === "description") current.description = value;
    if (property[1] === "required") current.required = value.toLowerCase() === "true";
  }

  if (current?.name) result.push(current);
  return result.map((argument) => ({
    ...argument,
    choices: inferArgumentChoices(argument.description),
  }));
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function commandNameFromRelativePath(relativePath: string): string {
  return toPosixPath(relativePath)
    .replace(/\.md$/i, "")
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("-");
}

async function collectMarkdownEntriesRecursive(rootDir: string): Promise<DirEntry[]> {
  const out: DirEntry[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const dir = queue.shift();
    if (!dir) continue;

    const entries = await invoke<DirEntry[]>("list_directory", { path: dir });
    for (const entry of entries) {
      if (entry.isDir) {
        queue.push(entry.path);
        continue;
      }

      if (entry.name.toLowerCase().endsWith(".md")) {
        out.push(entry);
      }
    }
  }

  return out;
}

function rawToDefinition(name: string, path: string, raw: string): SlashCommandDefinition {
  const meta = parseFrontmatter(raw);
  const yamlArgs = parseCommandArguments(raw);
  const hintArgs = parseArgumentHint(meta["argument-hint"] ?? meta.argumentHint ?? "");
  return {
    name,
    source: "file",
    sourceLabel: "file",
    path,
    description: meta.description ?? "",
    argumentHint: meta["argument-hint"] ?? meta.argumentHint ?? undefined,
    arguments: yamlArgs.length > 0 ? yamlArgs : hintArgs,
    content: raw,
    agent: parseSlashCommandAgent(raw),
    hidden: meta.hidden?.toLowerCase() === "true" || meta["disable-model-invocation"]?.toLowerCase() === "true",
  };
}

/** Agent name from command frontmatter (`agent:`), unused for routing. */
export function parseSlashCommandAgent(raw: string): string | undefined {
  const agent = parseFrontmatter(raw).agent?.trim();
  return agent || undefined;
}

function normalizeCommandName(name: string): string {
  return name.trim().replace(/^\/+/, "").toLowerCase();
}

export function registerSlashCommandExtension(extension: SlashCommandExtension): void {
  const key = normalizeCommandName(extension.name);
  if (!key) return;
  slashCommandExtensions.set(key, { ...extension, name: key });
}

export function unregisterSlashCommandExtension(name: string): void {
  slashCommandExtensions.delete(normalizeCommandName(name));
}

export function listSlashCommandExtensions(): SlashCommandExtension[] {
  return Array.from(slashCommandExtensions.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function ensureDefaultExtensionsRegistered(): void {
  if (defaultExtensionsRegistered) return;
  defaultExtensionsRegistered = true;

}

function extensionToDefinition(
  extension: SlashCommandExtension
): SlashCommandDefinition {
  return {
    name: extension.name,
    source: "extension",
    sourceLabel: extension.builtin ? "builtin" : "extension",
    path: "",
    description: extension.description,
    argumentHint: extension.argumentHint,
    arguments: [],
    content: "",
  };
}

export function getSeedSlashCommands(): SlashCommandDefinition[] {
  ensureDefaultExtensionsRegistered();
  return listSlashCommandExtensions()
    .map(extensionToDefinition)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Scan `.niuma/commands` recursively at the project root and return all valid command
 * definitions.  Returns an empty array when running outside Tauri or if the
 * directory does not exist.
 */
export async function loadSlashCommands(
  commandsDir?: string
): Promise<SlashCommandDefinition[]> {
  const extensionDefs = getSeedSlashCommands();

  if (!isTauri()) return extensionDefs;

  try {
    let dir = commandsDir;
    if (!dir) {
      dir = await invoke<string>("get_niuma_commands_dir").catch(() => "");
      if (!dir) return extensionDefs;
    }

    const files = await collectMarkdownEntriesRecursive(dir);

    const definitions = await Promise.allSettled(
      files.map(async (e) => {
        const raw = await invoke<string>("read_text_file", { path: e.path });
        const relativePath = toPosixPath(e.path).replace(`${toPosixPath(dir)}/`, "");
        const name = commandNameFromRelativePath(relativePath);
        return rawToDefinition(name, e.path, raw);
      })
    );

    const fileDefs = definitions
      .filter(
        (r): r is PromiseFulfilledResult<SlashCommandDefinition> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .sort((a, b) => a.name.localeCompare(b.name));

    const merged = new Map<string, SlashCommandDefinition>();

    // Prefer file commands when there is a name collision.
    for (const ext of extensionDefs) merged.set(ext.name, ext);
    for (const cmd of fileDefs) merged.set(cmd.name, cmd);

    return Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } catch (error) {
    console.warn("[slash-commands] Failed to load commands from", commandsDir ?? "catalog commandDir", error);
    return extensionDefs;
  }
}

// ─── Input parsing ────────────────────────────────────────────────────────────

/**
 * If the input is a bare slash-query (e.g. "/" or "/prof"), return the query
 * fragment.  Returns null if the input is not a slash-query.
 */
export function parseSlashQuery(input: string): string | null {
  const match = input.match(/^\/([^\s]*)$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Parse a completed slash invocation (e.g. "/profile set F 175").
 * Returns null if the input is not a slash invocation.
 */
export function parseSlashInvocation(
  input: string
): { command: string; args: string } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^\/([A-Za-z0-9_:-]+(?:-[A-Za-z0-9_:-]+)*)(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: normalizeCommandName(match[1]), args: (match[2] ?? "").trim() };
}

/** Resolve the positional argument currently being entered after `/command `. */
export function getSlashArgumentCompletion(
  input: string,
  commands: SlashCommandDefinition[]
): SlashArgumentCompletion | null {
  const match = input.match(/^\/([A-Za-z0-9_:-]+(?:-[A-Za-z0-9_:-]+)*)\s([\s\S]*)$/);
  if (!match) return null;

  const command = commands.find(
    (item) => item.name === normalizeCommandName(match[1])
  );
  if (!command) return null;

  const argumentText = match[2];
  const tokens = argumentText.trim().split(/\s+/).filter(Boolean);
  const endsWithWhitespace = /\s$/.test(argumentText);
  const prefix = endsWithWhitespace ? "" : tokens.pop() ?? "";
  const argumentIndex = tokens.length;
  const argument = command.arguments[argumentIndex];
  if (!argument) return null;

  const normalizedPrefix = prefix.toLowerCase();
  const prefixMatches = argument.choices.filter((choice) =>
    choice.value.toLowerCase().startsWith(normalizedPrefix)
  );
  const containsMatches = argument.choices.filter(
    (choice) =>
      !choice.value.toLowerCase().startsWith(normalizedPrefix) &&
      choice.value.toLowerCase().includes(normalizedPrefix)
  );

  return {
    command,
    argument,
    argumentIndex,
    prefix,
    choices: [...prefixMatches, ...containsMatches],
  };
}

// ─── Suggestion ranking ───────────────────────────────────────────────────────

/**
 * Return commands ranked by relevance: `startsWith` match first, then
 * `includes` matches, mirroring standard command-palette behavior.
 */
export function rankSlashCommands(
  commands: SlashCommandDefinition[],
  query: string
): SlashCommandDefinition[] {
  const visible = commands.filter((c) => !c.hidden);
  if (!query) return visible;
  const startsWith = visible.filter((c) => c.name.startsWith(query));
  const includes = visible.filter(
    (c) => !c.name.startsWith(query) && c.name.includes(query)
  );
  return [...startsWith, ...includes];
}

export interface SlashSkillCandidate {
  slug: string;
  name: string;
  command: string;
  description: string;
}

/** Skills shown beside commands when the input is `/` or `/query`. */
export function rankSlashSkills<T extends SlashSkillCandidate>(
  skills: T[],
  query: string,
  options?: { teamSlugs?: string[]; excludeCommands?: string[] },
): T[] {
  const teamSlugs = (options?.teamSlugs ?? []).filter(Boolean);
  const scoped = teamSlugs.length > 0
    ? skills.filter((skill) => teamSlugs.includes(skill.slug))
    : skills;
  const needle = query.trim().toLowerCase();
  const matched = !needle
    ? scoped
    : scoped.filter((skill) =>
        [skill.name, skill.command, skill.slug, skill.description]
          .join("\n")
          .toLowerCase()
          .includes(needle),
      );
  const excluded = new Set((options?.excludeCommands ?? []).map((name) => name.toLowerCase()));
  return matched.filter((skill) => !excluded.has(skill.command.toLowerCase()));
}

// ─── Execution prompt builder ─────────────────────────────────────────────────

/**
 * Build the prompt that is forwarded to the PI agent when a slash command is
 * invoked.  The full command spec is inlined so the agent can follow it
 * without a separate file-read round-trip.
 */
export function buildCommandExecutionPrompt(
  command: SlashCommandDefinition,
  args: string
): string {
  return expandCommandPlaceholders(stripCommandFrontmatter(command.content), args);
}

/**
 * Resolves user slash input into routed prompt text for agent-chat.
 * - file command: inline command spec prompt
 * - extension command: handler-generated prompt
 * - unknown command: returns null to preserve raw input behavior
 */
export function resolveSlashInvocationPrompt(
  input: string,
  commands: SlashCommandDefinition[]
): string | null {
  const resolution = resolveSlashInvocation(input, commands);
  return resolution?.kind === "prompt" ? resolution.text : null;
}

/**
 * Resolves slash input into either prompt-routing text or a local action.
 */
export function resolveSlashInvocation(
  input: string,
  commands: SlashCommandDefinition[]
): SlashCommandResolution | null {
  const slash = parseSlashInvocation(input);
  if (!slash) return null;

  const command = commands.find((item) => item.name === slash.command);
  if (!command) return null;

  if (command.source === "file") {
    return {
      kind: "prompt",
      text: buildCommandExecutionPrompt(command, slash.args),
    };
  }

  const extension = slashCommandExtensions.get(command.name);
  if (!extension) return null;

  return extension.handler(slash.args, { commands }) ?? null;
}
