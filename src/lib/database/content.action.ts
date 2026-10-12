import { getDatabase } from "./config";
import type {
  ContentEntry,
  ContentEntrySource,
  ContentEntryType,
  ContentProfile,
  DbContentEntry,
  DbContentProfile,
} from "@/types/content.type";

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseStructured(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function profileFromDb(row: DbContentProfile): ContentProfile {
  return {
    id: row.id,
    version: row.version,
    structured: parseStructured(row.structured_json),
    createdAt: row.created_at,
  };
}

function entryFromDb(row: DbContentEntry): ContentEntry {
  return {
    id: row.id,
    type: row.type as ContentEntryType,
    occurredAt: row.occurred_at,
    title: row.title,
    summary: row.summary,
    rawText: row.raw_text ?? undefined,
    source: row.source as ContentEntrySource,
    sourceRef: row.source_ref ?? undefined,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function latestContentProfile(): Promise<ContentProfile | null> {
  const db = await getDatabase();
  const rows = await db.select<DbContentProfile[]>(
    "SELECT * FROM content_profiles ORDER BY version DESC LIMIT 1",
    [],
  );
  return rows.length > 0 ? profileFromDb(rows[0]) : null;
}

export async function appendContentProfile(
  structured: Record<string, string>,
): Promise<ContentProfile> {
  const db = await getDatabase();
  const current = await latestContentProfile();
  const version = (current?.version ?? 0) + 1;
  const merged = { ...(current?.structured ?? {}), ...structured };
  const now = Date.now();
  const id = uuidv4();
  await db.execute(
    `INSERT INTO content_profiles (id, version, structured_json, created_at)
     VALUES ($1, $2, $3, $4)`,
    [id, version, JSON.stringify(merged), now],
  );
  return { id, version, structured: merged, createdAt: now };
}

export async function createContentEntry(input: {
  type: ContentEntryType;
  occurredAt?: number;
  title?: string;
  summary?: string;
  rawText?: string;
  source?: ContentEntrySource;
  sourceRef?: string;
  tags?: string[];
}): Promise<ContentEntry> {
  const db = await getDatabase();
  const now = Date.now();
  const id = uuidv4();
  const occurredAt = input.occurredAt ?? now;
  const summary = input.summary ?? "";
  const title = input.title ?? "";
  await db.execute(
    `INSERT INTO content_entries
       (id, type, occurred_at, title, summary, raw_text, source, source_ref, tags_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      input.type,
      occurredAt,
      title,
      summary,
      input.rawText ?? null,
      input.source ?? "manual",
      input.sourceRef ?? null,
      JSON.stringify(input.tags ?? []),
      now,
      now,
    ],
  );
  return {
    id,
    type: input.type,
    occurredAt,
    title,
    summary,
    rawText: input.rawText,
    source: input.source ?? "manual",
    sourceRef: input.sourceRef,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function listContentEntries(opts?: {
  type?: ContentEntryType;
  since?: number;
  until?: number;
  query?: string;
  limit?: number;
}): Promise<ContentEntry[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (opts?.type) {
    conditions.push(`type = $${paramIndex++}`);
    params.push(opts.type);
  }
  if (opts?.since != null) {
    conditions.push(`occurred_at >= $${paramIndex++}`);
    params.push(opts.since);
  }
  if (opts?.until != null) {
    conditions.push(`occurred_at <= $${paramIndex++}`);
    params.push(opts.until);
  }
  if (opts?.query?.trim()) {
    const like = `%${opts.query.trim().replace(/[%_]/g, "")}%`;
    conditions.push(
      `(title LIKE $${paramIndex} OR summary LIKE $${paramIndex} OR IFNULL(raw_text, '') LIKE $${paramIndex} OR IFNULL(source_ref, '') LIKE $${paramIndex})`,
    );
    params.push(like);
    paramIndex += 1;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 50;
  params.push(limit);
  const rows = await db.select<DbContentEntry[]>(
    `SELECT * FROM content_entries ${where} ORDER BY occurred_at DESC LIMIT $${paramIndex}`,
    params,
  );
  return rows.map(entryFromDb);
}
