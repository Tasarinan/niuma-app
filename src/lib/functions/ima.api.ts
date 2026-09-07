/**
 * IMA (腾讯IMA) OpenAPI helpers for niuma-app.
 *
 * Auth: `.env.local` IMA_CLIENT_ID / IMA_API_KEY, sent as official
 * `ima-openapi-*` headers via plugin-http. Do not use sandboxed ima_api.cjs
 * (env_clear strips KEY vars and causes 认证失败).
 *
 * "文章资产" knowledge base layout:
 *   ├── 蜜粉/   (mifenFolderId)    — collected articles / references
 *   └── 飞鸟/   (feiniaoFolderId) — written & published articles
 */

import { runImaOpenApi } from "@/lib/ima/openapi";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstArray(
  data: Record<string, unknown>,
  keys: string[],
): Record<string, unknown>[] {
  for (const key of keys) {
    const v = data[key];
    if (Array.isArray(v)) return v.map(asRecord);
  }
  return [];
}

/** Extract the folder / item ID from an IMA knowledge-list entry. */
function extractItemId(item: Record<string, unknown>): string {
  return String(item.media_id ?? item.id ?? item.folder_id ?? item.kb_id ?? "");
}

export async function runImaApi(
  apiPath: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return runImaOpenApi(apiPath, body);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ImaResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface ImaKbItem {
  id: string;
  title: string;
  mediaType: number;
}

/**
 * Save a written article to the 飞鸟 folder in "文章资产" KB.
 *
 * Flow:
 *   1. Create an IMA note (`import_doc`) with the Markdown content.
 *   2. Link the note to the KB (`add_knowledge`, media_type=11),
 *      optionally scoped to feiniaoFolderId.
 *
 * Local image references are stripped because IMA notes only accept URLs.
 */
export async function importMarkdownToFeiniao(
  title: string,
  content: string,
  kbId: string,
  feiniaoFolderId?: string,
): Promise<ImaResult> {
  // Strip local image references
  const sanitized = content.replace(/!\[([^\]]*)\]\((?!https?:\/\/)[^)]*\)/g, "");

  // 1. Create a note
  let docId: string;
  try {
    const noteData = await runImaApi("openapi/note/v1/import_doc", {
      content_format: 1,
      content: `# ${title}\n\n${sanitized}`,
    });
    docId = String(noteData.note_id ?? noteData.doc_id ?? "");
    if (!docId) throw new Error("No note_id in import_doc response");
  } catch (e) {
    return { success: false, error: `创建笔记失败: ${String(e)}` };
  }

  // 2. Link note to 飞鸟 folder in the KB
  try {
    const addBody: Record<string, unknown> = {
      media_type: 11,
      note_info: { content_id: docId },
      title,
      knowledge_base_id: kbId,
    };
    if (feiniaoFolderId) addBody.folder_id = feiniaoFolderId;

    await runImaApi("openapi/wiki/v1/add_knowledge", addBody);
    return { success: true, id: docId };
  } catch (e) {
    return { success: false, error: `关联知识库失败: ${String(e)}` };
  }
}

/**
 * List items in the 飞鸟 folder (or KB root if no folder ID is given).
 * Media type 99 = folder; other types = actual content.
 */
export async function listFeiniaoArticles(
  kbId: string,
  feiniaoFolderId?: string,
): Promise<ImaKbItem[]> {
  try {
    const body: Record<string, unknown> = {
      knowledge_base_id: kbId,
      cursor: "",
      limit: 50,
    };
    if (feiniaoFolderId) body.folder_id = feiniaoFolderId;

    const data = await runImaApi("openapi/wiki/v1/get_knowledge_list", body);
    // Real API response key is "knowledge_list"
    const items = firstArray(data, ["knowledge_list", "info_list", "infoList", "list"]);
    return items
      .filter((item) => item.media_type !== 99) // exclude sub-folders
      .map((item) => ({
        id: extractItemId(item),
        title: String(item.title ?? item.name ?? "未命名"),
        mediaType: Number(item.media_type ?? 0),
      }));
  } catch {
    return [];
  }
}

/**
 * List all accessible IMA knowledge bases (empty query = all).
 */
export async function listImaKnowledgeBases(): Promise<Array<{ id: string; name: string }>> {
  try {
    const data = await runImaApi("openapi/wiki/v1/search_knowledge_base", {
      query: "",
      cursor: "",
      limit: 50,
    });
    const list = firstArray(data, ["info_list", "infoList", "list"]);
    return list.map((kb) => ({ id: String(kb.kb_id ?? kb.id ?? ""), name: String(kb.kb_name ?? kb.name ?? "") }));
  } catch {
    return [];
  }
}
