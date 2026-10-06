import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  findRoleByCommand,
  isCatalogTeamPack,
  listAgentFilesFromManifest,
  listDefaultCommandFromManifest,
  listSkillSlugsFromManifest,
  mergeTeamPackManifest,
  parseTeamPackManifest,
  parseTeamRoles,
  resolveDefaultRole,
} from "@/lib/agent/team-manifest";

function loadTeamPack(id: string) {
  const roster = parseTeamPackManifest(
    readFileSync(resolve(`.niuma/teams/${id}/config.yaml`), "utf8"),
  );
  const extra = parseTeamPackManifest(
    readFileSync(resolve(`.niuma/teams/${id}/presets/team.yaml`), "utf8"),
  );
  return mergeTeamPackManifest(roster, extra);
}

describe("team manifest", () => {
  it("parses workflow roles from config yaml", () => {
    const yaml = `
id: content
workflow: content
workspaceRoot: true
roles:
  - agentFile: producer.md
    name: 主理人
    skills:
      - article-main
    commands:
      - article
    summary: 主持
`;
    const roles = parseTeamRoles(yaml);
    expect(roles).toHaveLength(1);
    expect(roles[0].name).toBe("主理人");
    expect(roles[0].skills).toEqual(["article-main"]);

    const pack = parseTeamPackManifest(yaml);
    expect(pack.workflow).toBe("content");
    expect(pack.workspaceRoot).toBe(true);
    expect(pack.workbench).toBe(true);
  });

  it("treats main catalog pack as non-workbench", () => {
    const yaml = `
id: main
surface: catalog
workbench: false
`;
    const pack = parseTeamPackManifest(yaml);
    expect(pack.workbench).toBe(false);
  });

  it("does not treat a team as catalog just because id is main", () => {
    const pack = parseTeamPackManifest(`
id: main
name: 不是共享库
surface: default
`);
    expect(pack.workbench).toBe(true);
    expect(pack.surface).toBe("default");
    expect(isCatalogTeamPack(pack)).toBe(false);
  });

  it("reads catalog roster from config.yaml and chrome from presets/team.yaml", () => {
    const pack = loadTeamPack("main");
    expect(pack.surface).toBe("catalog");
    expect(pack.workbench).toBe(false);
    expect(pack.defaultAgent).toBe("assistant.md");
    expect(pack.channelName).toBe("主对话");
    const agentFiles = listAgentFilesFromManifest(pack);
    expect(agentFiles.length).toBeGreaterThan(0);
    expect(pack.roles).toHaveLength(agentFiles.length);
    expect(pack.defaultHired).toEqual(["assistant.md"]);
    expect(isCatalogTeamPack(pack)).toBe(true);
    expect(resolveDefaultRole(pack)?.agentFile).toBe("assistant.md");
    expect(resolveDefaultRole(pack)?.summary).toBeTruthy();
    for (const file of agentFiles) {
      expect(pack.roles.some((role) => role.agentFile === file)).toBe(true);
    }
  });

  it("reads content team agents, skills, and commands from config.yaml", () => {
    const pack = loadTeamPack("content");
    expect(pack.id).toBe("content");
    expect(pack.name).toBe("内容创作");
    expect(pack.workflow).toBe("content");
    expect(pack.workspaceRoot).toBe(true);
    const agentFiles = listAgentFilesFromManifest(pack);
    const skillSlugs = listSkillSlugsFromManifest(pack);
    expect(agentFiles.length).toBeGreaterThan(0);
    expect(pack.roles).toHaveLength(agentFiles.length);
    for (const file of agentFiles) {
      expect(pack.roles.some((role) => role.agentFile === file)).toBe(true);
    }
    const producer = resolveDefaultRole(pack);
    expect(producer?.agentFile).toBe("producer.md");
    expect(producer?.summary).toBeTruthy();
    expect(listDefaultCommandFromManifest(pack)).toBe("article");
    expect(findRoleByCommand(pack.roles, listDefaultCommandFromManifest(pack) ?? "")?.agentFile).toBe(
      "producer.md",
    );
    expect(findRoleByCommand(pack.roles, "publish")?.name).toBeTruthy();
    expect(findRoleByCommand(pack.roles, "image")?.commands).toContain("image");
    const allRoleSkills = pack.roles.flatMap((role) => role.skills);
    for (const slug of allRoleSkills) {
      expect(skillSlugs).toContain(slug);
    }
  });

  it("reads health, meeting, and study rosters from their config.yaml", () => {
    for (const id of ["health", "meeting", "study"] as const) {
      const pack = loadTeamPack(id);
      expect(pack.id).toBe(id);
      const agentFiles = listAgentFilesFromManifest(pack);
      expect(agentFiles.length).toBeGreaterThan(0);
      expect(pack.roles).toHaveLength(agentFiles.length);
      expect(resolveDefaultRole(pack)?.agentFile).toBeTruthy();
      expect(findRoleByCommand(pack.roles, listDefaultCommandFromManifest(pack) ?? "")?.name).toBeTruthy();
      for (const file of agentFiles) {
        expect(pack.roles.some((role) => role.agentFile === file)).toBe(true);
      }
    }
  });
});
