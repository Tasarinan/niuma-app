import { parseSlashInvocation } from "@/lib/slash-commands";

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** Prefer the user's question, not the slash command name, as the search query. */
export function searchQueryFromComposerInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const slash = parseSlashInvocation(trimmed);
  if (slash) return slash.args.trim();
  return trimmed;
}

export function formatWebSearchHits(results: WebSearchHit[]): string {
  return results
    .map((r, i) => {
      const snippet = r.snippet.trim();
      return `${i + 1}. ${r.title}${snippet ? `\n   ${snippet}` : ""}\n   ${r.url}`;
    })
    .join("\n\n");
}
