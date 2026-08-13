/**
 * `memory` PI tool — gives agents read/write access to the team's
 * file-based memory store (inspired by pi-memory).
 *
 * Actions:
 *   add    — append an entry to a topic file and update MEMORY.md index
 *   search — full-text search across all topic files
 *   read   — read a single topic file
 *   list   — list all topic file names
 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  addMemoryEntry,
  searchMemory,
  readTopicFile,
  listTopicFiles,
} from "./file-memory";

/** Build the memory tool bound to a specific team. */
export function buildMemoryTool(teamId: string): AgentTool {
  return {
    name: "memory",
    label: "Team Memory",
    description:
      "Read and write persistent memory shared across all agents in this team. " +
      "Use `add` to store learnings/preferences/facts; `search` to recall relevant entries; " +
      "`read` to inspect a topic file; `list` to see all topics.",
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("add"),
          Type.Literal("search"),
          Type.Literal("read"),
          Type.Literal("list"),
        ],
        { description: "Memory action to perform" }
      ),
      topic: Type.Optional(
        Type.String({
          description:
            "Target topic filename slug (e.g. \"preferences\", \"project-context\"). Required for `add` and `read`.",
        })
      ),
      title: Type.Optional(
        Type.String({
          description: "Entry heading. Required for `add`.",
        })
      ),
      content: Type.Optional(
        Type.String({
          description: "Knowledge text to persist. Required for `add`.",
        })
      ),
      query: Type.Optional(
        Type.String({
          description: "Search keyword. Required for `search`.",
        })
      ),
    }),
    async execute(
      _id: string,
      params: {
        action: "add" | "search" | "read" | "list";
        topic?: string;
        title?: string;
        content?: string;
        query?: string;
      }
    ) {
      try {
        switch (params.action) {
          case "add": {
            if (!params.topic || !params.title || !params.content) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Error: `topic`, `title`, and `content` are required for action=add",
                  },
                ],
              };
            }
            await addMemoryEntry(teamId, {
              topic: params.topic,
              title: params.title,
              content: params.content,
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Memory saved: [${params.topic}] ${params.title}`,
                },
              ],
            };
          }

          case "search": {
            if (!params.query) {
              return {
                content: [
                  { type: "text" as const, text: "Error: `query` is required for action=search" },
                ],
              };
            }
            const results = await searchMemory(teamId, params.query);
            if (results.length === 0) {
              return {
                content: [
                  { type: "text" as const, text: `No memory entries found for "${params.query}".` },
                ],
              };
            }
            const text = results
              .map((r) => `### ${r.title}\n${r.content}`)
              .join("\n\n");
            return { content: [{ type: "text" as const, text }] };
          }

          case "read": {
            if (!params.topic) {
              return {
                content: [
                  { type: "text" as const, text: "Error: `topic` is required for action=read" },
                ],
              };
            }
            const raw = await readTopicFile(teamId, params.topic);
            return {
              content: [
                {
                  type: "text" as const,
                  text: raw || `Topic "${params.topic}" not found.`,
                },
              ],
            };
          }

          case "list": {
            const topics = await listTopicFiles(teamId);
            return {
              content: [
                {
                  type: "text" as const,
                  text:
                    topics.length === 0
                      ? "No memory topics yet."
                      : `Topics: ${topics.join(", ")}`,
                },
              ],
            };
          }
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  } as unknown as AgentTool;
}
