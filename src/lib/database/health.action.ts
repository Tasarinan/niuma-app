import { getDatabase } from "./config";
import type {
  AbnormalFlag,
  DbHealthAiInterpretation,
  DbHealthAttachment,
  DbHealthObservation,
  DbHealthPerson,
  DbHealthRecord,
  HealthAiInterpretation,
  HealthAttachment,
  HealthObservation,
  HealthPerson,
  HealthRecord,
  HealthRecordSource,
  HealthRecordType,
  PersonRelation,
} from "@/types/health.type";

// ─── UUID v4 (no external dependency) ────────────────────────────────────────

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Converters ───────────────────────────────────────────────────────────────

function personFromDb(r: DbHealthPerson): HealthPerson {
  return {
    id: r.id,
    name: r.name,
    relation: r.relation as PersonRelation,
    birthDate: r.birth_date ?? undefined,
    sex: (r.sex as HealthPerson["sex"]) ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function recordFromDb(r: DbHealthRecord): HealthRecord {
  return {
    id: r.id,
    personId: r.person_id,
    type: r.type as HealthRecordType,
    occurredAt: r.occurred_at,
    title: r.title,
    summary: r.summary,
    source: r.source as HealthRecordSource,
    confidence: r.confidence ?? undefined,
    rawText: r.raw_text ?? undefined,
    structuredJson: r.structured_json ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function attachmentFromDb(r: DbHealthAttachment): HealthAttachment {
  return {
    id: r.id,
    recordId: r.record_id,
    filePath: r.file_path,
    mimeType: r.mime_type,
    sha256: r.sha256 ?? undefined,
    sizeBytes: r.size_bytes ?? undefined,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    createdAt: r.created_at,
  };
}

function observationFromDb(r: DbHealthObservation): HealthObservation {
  return {
    id: r.id,
    recordId: r.record_id,
    personId: r.person_id,
    code: r.code,
    displayName: r.display_name,
    valueNum: r.value_num ?? undefined,
    valueText: r.value_text ?? undefined,
    unit: r.unit ?? undefined,
    referenceLow: r.reference_low ?? undefined,
    referenceHigh: r.reference_high ?? undefined,
    abnormalFlag: (r.abnormal_flag as AbnormalFlag) ?? undefined,
    confidence: r.confidence ?? undefined,
    observedAt: r.observed_at,
    createdAt: r.created_at,
  };
}

function aiInterpretationFromDb(r: DbHealthAiInterpretation): HealthAiInterpretation {
  return {
    id: r.id,
    recordId: r.record_id,
    model: r.model,
    promptVersion: r.prompt_version,
    resultJson: r.result_json,
    summary: r.summary,
    warningsJson: r.warnings_json,
    confidence: r.confidence ?? undefined,
    createdAt: r.created_at,
  };
}

// ─── People ───────────────────────────────────────────────────────────────────

export async function listHealthPeople(): Promise<HealthPerson[]> {
  const db = await getDatabase();
  const rows = await db.select<DbHealthPerson[]>(
    "SELECT * FROM health_people ORDER BY relation, name",
    []
  );
  return rows.map(personFromDb);
}

/** Return the "self" person, creating one with the given name if none exists. */
export async function getOrCreateSelfPerson(name = "我"): Promise<HealthPerson> {
  const db = await getDatabase();
  const rows = await db.select<DbHealthPerson[]>(
    "SELECT * FROM health_people WHERE relation = 'self' LIMIT 1",
    []
  );
  if (rows.length > 0) return personFromDb(rows[0]);
  return createHealthPerson({ name, relation: "self" });
}

export async function createHealthPerson(input: {
  name: string;
  relation: PersonRelation;
  birthDate?: string;
  sex?: "M" | "F" | "O";
  notes?: string;
}): Promise<HealthPerson> {
  const db = await getDatabase();
  const now = Date.now();
  const id = uuidv4();
  await db.execute(
    `INSERT INTO health_people (id, name, relation, birth_date, sex, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, input.name, input.relation, input.birthDate ?? null, input.sex ?? null, input.notes ?? null, now, now]
  );
  const rows = await db.select<DbHealthPerson[]>(
    "SELECT * FROM health_people WHERE id = $1",
    [id]
  );
  return personFromDb(rows[0]);
}

// ─── Records ──────────────────────────────────────────────────────────────────

export async function createHealthRecord(input: {
  personId: string;
  type: HealthRecordType;
  occurredAt: number;
  title: string;
  summary?: string;
  source?: HealthRecordSource;
  confidence?: number;
  rawText?: string;
  structuredJson?: string;
}): Promise<HealthRecord> {
  const db = await getDatabase();
  const now = Date.now();
  const id = uuidv4();
  await db.execute(
    `INSERT INTO health_records
       (id, person_id, type, occurred_at, title, summary, source, confidence, raw_text, structured_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      input.personId,
      input.type,
      input.occurredAt,
      input.title,
      input.summary ?? "",
      input.source ?? "manual",
      input.confidence ?? null,
      input.rawText ?? null,
      input.structuredJson ?? null,
      now,
      now,
    ]
  );
  const rows = await db.select<DbHealthRecord[]>(
    "SELECT * FROM health_records WHERE id = $1",
    [id]
  );
  return recordFromDb(rows[0]);
}

export async function getHealthRecord(id: string): Promise<HealthRecord | null> {
  const db = await getDatabase();
  const rows = await db.select<DbHealthRecord[]>(
    "SELECT * FROM health_records WHERE id = $1",
    [id]
  );
  return rows.length > 0 ? recordFromDb(rows[0]) : null;
}

export async function listHealthRecords(opts: {
  personId?: string;
  type?: HealthRecordType;
  limit?: number;
  offset?: number;
}): Promise<HealthRecord[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (opts.personId) {
    conditions.push(`person_id = $${paramIndex++}`);
    params.push(opts.personId);
  }
  if (opts.type) {
    conditions.push(`type = $${paramIndex++}`);
    params.push(opts.type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  params.push(limit, offset);

  const rows = await db.select<DbHealthRecord[]>(
    `SELECT * FROM health_records ${where} ORDER BY occurred_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    params
  );
  return rows.map(recordFromDb);
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function addHealthAttachment(input: {
  id: string;
  recordId: string;
  filePath: string;
  mimeType: string;
  sizeBytes?: number;
}): Promise<HealthAttachment> {
  const db = await getDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO health_attachments (id, record_id, file_path, mime_type, sha256, size_bytes, width, height, created_at)
     VALUES ($1, $2, $3, $4, NULL, $5, NULL, NULL, $6)`,
    [input.id, input.recordId, input.filePath, input.mimeType, input.sizeBytes ?? null, now]
  );
  const rows = await db.select<DbHealthAttachment[]>(
    "SELECT * FROM health_attachments WHERE id = $1",
    [input.id]
  );
  return attachmentFromDb(rows[0]);
}

export async function listHealthAttachments(recordId: string): Promise<HealthAttachment[]> {
  const db = await getDatabase();
  const rows = await db.select<DbHealthAttachment[]>(
    "SELECT * FROM health_attachments WHERE record_id = $1 ORDER BY created_at",
    [recordId]
  );
  return rows.map(attachmentFromDb);
}

// ─── Observations ─────────────────────────────────────────────────────────────

export async function addHealthObservations(
  items: Array<{
    recordId: string;
    personId: string;
    code: string;
    displayName: string;
    valueNum?: number;
    valueText?: string;
    unit?: string;
    referenceLow?: number;
    referenceHigh?: number;
    abnormalFlag?: AbnormalFlag;
    confidence?: number;
    observedAt: number;
  }>
): Promise<HealthObservation[]> {
  const db = await getDatabase();
  const now = Date.now();
  const results: HealthObservation[] = [];
  for (const item of items) {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO health_observations
         (id, record_id, person_id, code, display_name, value_num, value_text, unit,
          reference_low, reference_high, abnormal_flag, confidence, observed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        item.recordId,
        item.personId,
        item.code,
        item.displayName,
        item.valueNum ?? null,
        item.valueText ?? null,
        item.unit ?? null,
        item.referenceLow ?? null,
        item.referenceHigh ?? null,
        item.abnormalFlag ?? null,
        item.confidence ?? null,
        item.observedAt,
        now,
      ]
    );
    results.push({
      id,
      recordId: item.recordId,
      personId: item.personId,
      code: item.code,
      displayName: item.displayName,
      valueNum: item.valueNum,
      valueText: item.valueText,
      unit: item.unit,
      referenceLow: item.referenceLow,
      referenceHigh: item.referenceHigh,
      abnormalFlag: item.abnormalFlag,
      confidence: item.confidence,
      observedAt: item.observedAt,
      createdAt: now,
    });
  }
  return results;
}

export async function listHealthObservations(opts: {
  personId?: string;
  code?: string;
  recordId?: string;
  limit?: number;
}): Promise<HealthObservation[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (opts.personId) {
    conditions.push(`person_id = $${paramIndex++}`);
    params.push(opts.personId);
  }
  if (opts.code) {
    conditions.push(`code = $${paramIndex++}`);
    params.push(opts.code);
  }
  if (opts.recordId) {
    conditions.push(`record_id = $${paramIndex++}`);
    params.push(opts.recordId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  params.push(limit);

  const rows = await db.select<DbHealthObservation[]>(
    `SELECT * FROM health_observations ${where} ORDER BY observed_at DESC LIMIT $${paramIndex}`,
    params
  );
  return rows.map(observationFromDb);
}

// ─── AI interpretations ───────────────────────────────────────────────────────

export async function addHealthAiInterpretation(input: {
  recordId: string;
  model: string;
  promptVersion?: string;
  resultJson: string;
  summary: string;
  warningsJson?: string;
  confidence?: number;
}): Promise<HealthAiInterpretation> {
  const db = await getDatabase();
  const now = Date.now();
  const id = uuidv4();
  await db.execute(
    `INSERT INTO health_ai_interpretations
       (id, record_id, model, prompt_version, result_json, summary, warnings_json, confidence, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.recordId,
      input.model,
      input.promptVersion ?? "v1",
      input.resultJson,
      input.summary,
      input.warningsJson ?? "[]",
      input.confidence ?? null,
      now,
    ]
  );
  const rows = await db.select<DbHealthAiInterpretation[]>(
    "SELECT * FROM health_ai_interpretations WHERE id = $1",
    [id]
  );
  return aiInterpretationFromDb(rows[0]);
}
