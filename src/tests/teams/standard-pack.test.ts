import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCatalogAgentMarkdown } from "@/lib/data/agent-loader";
import { parseArgumentHint } from "@/lib/slash-commands";
import { parseTeamPackManifest } from "@/lib/agent/team-manifest";
import { teamRolesFromAgentMarkdown } from "@/lib/agent/team-roles-from-agents";

const TEAMS_ROOT = ".teams";
const TEAM_YAML_KEYS = new Set([
  "id",
  "defaultAgent",
  "defaultHired",
  "surface",
  "workbench",
  "name",
  "description",
  "eyebrow",
  "avatar",
  "accent",
  "view",
  "workflow",
  "workspaceRoot",
  "dataDomain",
  "channelName",
  "starterPrompts",
  "commandDir",
  "defaultCommand",
  "kind",
  "agentFiles",
  "skillSlugs",
  "roles",
]);

function teamDirs(): string[] {
  return readdirSync(TEAMS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function scalarKeys(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/)?.[1])
    .filter((key): key is string => Boolean(key));
}

describe("standard team packs", () => {
  it("keeps team.yaml as the single pack manifest", () => {
    for (const id of teamDirs()) {
      const raw = readFileSync(join(TEAMS_ROOT, id, "team.yaml"), "utf8");
      for (const key of scalarKeys(raw)) {
        expect(TEAM_YAML_KEYS.has(key), `${id}/team.yaml unexpected key ${key}`).toBe(true);
      }
      const pack = parseTeamPackManifest(raw);
      expect(pack.id).toBe(id);
      expect(existsSync(join(TEAMS_ROOT, id, "team.yaml"))).toBe(true);
    }
  });

  it("derives at least one role from agents", () => {
    for (const id of teamDirs()) {
      const agentsDir = join(TEAMS_ROOT, id, "agents");
      const files = readdirSync(agentsDir)
        .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
        .map((file) => ({
          file,
          raw: readFileSync(join(agentsDir, file), "utf8"),
        }));
      const roles = teamRolesFromAgentMarkdown(files, id);
      expect(roles.length).toBeGreaterThan(0);
    }
  });

  it("writes commands in Claude/Cursor slash format", () => {
    for (const id of teamDirs()) {
      const dir = join(TEAMS_ROOT, id, "commands");
      let files: string[] = [];
      try {
        files = readdirSync(dir).filter((name) => name.endsWith(".md"));
      } catch {
        continue;
      }
      for (const file of files) {
        const raw = readFileSync(join(dir, file), "utf8").replace(/^\uFEFF/, "");
        expect(raw, `${id}/commands/${file}`).toMatch(/^---\r?\n/);
        expect(raw).toMatch(/^---\r?\n[\s\S]*description:/);
        expect(raw).not.toMatch(/^agent:/m);
        expect(raw).not.toMatch(/^arguments:/m);
        const hint = raw.match(/^argument-hint:\s*(.+)$/m)?.[1];
        if (hint) expect(parseArgumentHint(hint).length).toBeGreaterThan(0);
      }
    }
  });

  it("writes agents in OpenClaw frontmatter", () => {
    for (const id of teamDirs()) {
      const dir = join(TEAMS_ROOT, id, "agents");
      const files = readdirSync(dir).filter((name) => name.endsWith(".md") && !name.startsWith("_"));
      for (const file of files) {
        const raw = readFileSync(join(dir, file), "utf8").replace(/^\uFEFF/, "");
        expect(raw).not.toMatch(/^schemaVersion:/m);
        expect(raw).not.toMatch(/^enabledInternalTools:/m);
        expect(raw).not.toMatch(/^sandboxMode:/m);
        const agent = parseCatalogAgentMarkdown(file, raw, id);
        expect(agent.name.trim().length).toBeGreaterThan(0);
        expect(agent.name).not.toMatch(/Ã.|ä¸|é/);
      }
    }
  });
});
