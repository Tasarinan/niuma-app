import { describe, expect, it } from "vitest";
import {
  CONTENT_TEAM_CONFIG_REL,
  formatContentTeamConfigContext,
  parseContentTeamManifest,
  parseYamlBlockList,
} from "./content-team-config";

const sample = `
id: content
name: 内容创作
description: 编辑部
agentFiles:
  - producer.md
  - writer.md
skillSlugs:
  - article-main
  - article-review
default_author: 折叠的AI
title_max_length: 25
`;

describe("content team config", () => {
  it("parses roster lists from the merged yaml", () => {
    expect(parseYamlBlockList(sample, "agentFiles")).toEqual(["producer.md", "writer.md"]);
    const manifest = parseContentTeamManifest(sample);
    expect(manifest.name).toBe("内容创作");
    expect(manifest.skillSlugs).toEqual(["article-main", "article-review"]);
  });

  it("parses block lists with CRLF line endings", () => {
    const crlf = sample.replaceAll("\n", "\r\n");
    expect(parseYamlBlockList(crlf, "agentFiles")).toEqual(["producer.md", "writer.md"]);
    expect(parseYamlBlockList(crlf, "skillSlugs")).toEqual([
      "article-main",
      "article-review",
    ]);
    expect(parseContentTeamManifest(crlf).name).toBe("内容创作");
  });

  it("parses starter prompts and legacy names from team yaml", () => {
    const yaml = `
id: health
name: 健康
legacyNames:
  - 健康团队
agentFiles:
  - guide.md
skillSlugs:
  - ima-skill
starterPrompts:
  - /record 记一条
`;
    const manifest = parseContentTeamManifest(yaml);
    expect(manifest.legacyNames).toEqual(["健康团队"]);
    expect(manifest.agentFiles).toEqual(["guide.md"]);
    expect(manifest.starterPrompts).toEqual(["/record 记一条"]);
  });

  it("tells agents not to use .aws-article or a new .niuma-article folder", () => {
    const text = formatContentTeamConfigContext(sample);
    expect(text).toContain("[内容团队配置]");
    expect(text).toContain(CONTENT_TEAM_CONFIG_REL);
    expect(text).toContain("不要读 `.aws-article/config.yaml`");
    expect(text).toContain("不要创建 `.niuma-article/`");
    expect(text).toContain("review.md");
    expect(text).toContain("折叠的AI");
  });
});
