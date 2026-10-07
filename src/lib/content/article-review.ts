import { parseYamlScalars } from "@/lib/artifact/content-team-config";
import { draftFolderFromFilePath } from "@/lib/artifact/draft-workspace";

export const REVIEW_META_FILENAME = "review.meta.yaml";
export const REVIEW_SUGGESTIONS_FILENAME = "review.suggestions.json";
export const REVIEW_MD_FILENAME = "review.md";
export const REVIEW_HISTORY_DIR = ".history";

export type ReviewStatus = "pass" | "blocked";

export type ReviewMeta = {
  round: number;
  status: ReviewStatus;
  reviewed_at: string;
  article_sha256: string;
  blocker_count: number;
  reviewer?: string;
};

export type ReviewPatch = {
  type: "replace";
  old: string;
  new: string;
};

export type ReviewSuggestionItem = {
  id: string;
  severity: "blocker" | "suggestion";
  category: string;
  anchor: string;
  reason: string;
  suggestion?: string;
  patch?: ReviewPatch | null;
  applied?: boolean;
  dismissed?: boolean;
};

export type ReviewSuggestionsFile = {
  round: number;
  article_sha256: string;
  title?: {
    score?: number;
    candidates?: string[];
    issues?: string[];
  };
  items: ReviewSuggestionItem[];
};

export type ReviewBundle = {
  meta: ReviewMeta | null;
  suggestions: ReviewSuggestionsFile | null;
  reviewMd?: string;
};

export function draftFolderFromArticlePath(filePath?: string): string | null {
  if (!filePath) return null;
  return draftFolderFromFilePath(filePath);
}

export function reviewMetaPath(draftFolder: string): string {
  return `${draftFolder.replace(/\\/g, "/")}/${REVIEW_META_FILENAME}`;
}

export function reviewSuggestionsPath(draftFolder: string): string {
  return `${draftFolder.replace(/\\/g, "/")}/${REVIEW_SUGGESTIONS_FILENAME}`;
}

export function reviewMdPath(draftFolder: string): string {
  return `${draftFolder.replace(/\\/g, "/")}/${REVIEW_MD_FILENAME}`;
}

export function articleSnapshotPath(draftFolder: string, round: number): string {
  return `${draftFolder.replace(/\\/g, "/")}/${REVIEW_HISTORY_DIR}/article-r${round}.md`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parseReviewMeta(yamlText: string): ReviewMeta | null {
  const raw = parseYamlScalars(yamlText);
  const round = Number.parseInt(raw.round ?? "", 10);
  const blocker_count = Number.parseInt(raw.blocker_count ?? "", 10);
  const status = raw.status === "pass" || raw.status === "blocked" ? raw.status : null;
  const reviewed_at = (raw.reviewed_at ?? "").trim();
  const article_sha256 = (raw.article_sha256 ?? "").trim().toLowerCase();
  if (!Number.isFinite(round) || round < 1 || !status || !reviewed_at || !article_sha256) {
    return null;
  }
  return {
    round,
    status,
    reviewed_at,
    article_sha256,
    blocker_count: Number.isFinite(blocker_count) ? blocker_count : 0,
    reviewer: raw.reviewer?.trim() || undefined,
  };
}

export function parseReviewSuggestions(jsonText: string): ReviewSuggestionsFile | null {
  try {
    const parsed = JSON.parse(jsonText) as ReviewSuggestionsFile;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.round) || parsed.round < 1) return null;
    if (typeof parsed.article_sha256 !== "string" || !parsed.article_sha256.trim()) return null;
    if (!Array.isArray(parsed.items)) return null;
    const items = parsed.items.filter((item) => {
      if (!item || typeof item !== "object") return false;
      return (
        typeof item.id === "string" &&
        (item.severity === "blocker" || item.severity === "suggestion") &&
        typeof item.category === "string" &&
        typeof item.anchor === "string" &&
        typeof item.reason === "string"
      );
    });
    return {
      round: parsed.round,
      article_sha256: parsed.article_sha256.trim().toLowerCase(),
      title: parsed.title,
      items,
    };
  } catch {
    return null;
  }
}

export function countSubstringOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (index <= haystack.length) {
    const found = haystack.indexOf(needle, index);
    if (found < 0) break;
    count += 1;
    index = found + needle.length;
  }
  return count;
}

export function isReviewStale(meta: ReviewMeta | null, suggestions: ReviewSuggestionsFile | null, articleHash: string): boolean {
  const hash = articleHash.trim().toLowerCase();
  if (!hash) return false;
  if (meta?.article_sha256 && meta.article_sha256 !== hash) return true;
  if (suggestions?.article_sha256 && suggestions.article_sha256 !== hash) return true;
  return false;
}

export function applyReplacePatch(markdown: string, patch: ReviewPatch, anchor?: string): { ok: true; markdown: string } | { ok: false; reason: string } {
  const oldText = (patch.old || anchor || "").trim();
  const newText = patch.new ?? "";
  if (!oldText) return { ok: false, reason: "缺少替换原文" };
  const count = countSubstringOccurrences(markdown, oldText);
  if (count === 0) return { ok: false, reason: "正文中找不到锚点原文" };
  if (count > 1) return { ok: false, reason: `锚点在正文中出现 ${count} 次，无法安全替换` };
  return { ok: true, markdown: markdown.replace(oldText, newText) };
}

export function findAnchorRangeInDoc(
  doc: { descendants: (f: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void) => void },
  anchor: string,
): { from: number; to: number } | null {
  const needle = anchor.trim();
  if (!needle) return null;
  let match: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (match || !node.isText || !node.text) return;
    const index = node.text.indexOf(needle);
    if (index < 0) return;
    match = { from: pos + index, to: pos + index + needle.length };
  });
  return match;
}

export function upsertSuggestionState(
  file: ReviewSuggestionsFile,
  itemId: string,
  patch: Partial<Pick<ReviewSuggestionItem, "applied" | "dismissed">>,
): ReviewSuggestionsFile {
  return {
    ...file,
    items: file.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  };
}
