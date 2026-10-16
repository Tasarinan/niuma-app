import { describe, expect, it } from "vitest";
import {
  findCatalogAgentForTeamFile,
  teamAgentCatalogSlug,
  talentAvatarForCatalogSlug,
  type CatalogAgent,
} from "@/lib/data/agent-loader";

describe("team agent avatar helpers", () => {
  it("builds stable slugs per team file", () => {
    expect(teamAgentCatalogSlug("content", "writer.md")).toBe("content-writer");
  });

  it("assigns talent urls from slug", () => {
    const url = talentAvatarForCatalogSlug("content-writer");
    expect(url.length).toBeGreaterThan(0);
    expect(url).toBe(talentAvatarForCatalogSlug("content-writer"));
  });

  it("finds catalog entry by team and file", () => {
    const catalog: CatalogAgent[] = [
      {
        id: "agent:content-writer",
        slug: "content-writer",
        schemaVersion: "v1",
        sourceType: "niuma-markdown",
        sourcePath: "C:/ws/.teams/content/agents/writer.md",
        file: "writer.md",
        name: "写手",
        role: "写作",
        avatar: "/assets/writer.jpeg",
        description: "",
        fromTeams: true,
      },
    ];
    const found = findCatalogAgentForTeamFile(catalog, "content", "writer.md");
    expect(found?.name).toBe("写手");
  });
});
