import { Repository } from "./repository";
import type { AgentDefinition, Skill, McpServer, Artifact } from "@/types";

export const agentDefinitionRepo = new Repository<AgentDefinition>(
  "agentDefinitions",
  "agent"
);
export const skillRepo = new Repository<Skill>("skills", "skill");
export const mcpRepo = new Repository<McpServer>("mcpServers", "mcp");
export const artifactRepo = new Repository<Artifact>(
  "studioArtifacts",
  "artifact"
);
