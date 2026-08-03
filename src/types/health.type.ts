// ─── Record / domain types ────────────────────────────────────────────────────

export type HealthRecordType =
  | "lab_report"   // 化验单 / 体检报告
  | "imaging"      // 影像检查（CT/MRI/X-ray）
  | "meal"         // 饮食记录
  | "sleep"        // 睡眠记录
  | "symptom"      // 症状记录
  | "medication"   // 用药记录
  | "profile"      // 基础档案（身高体重血型等）
  | "fitness"      // 运动记录
  | "mood"         // 情绪/心理记录
  | "discharge"    // 出院小结
  | "surgery"      // 手术记录
  | "screening"    // 筛查记录
  | "note";        // 健康备注

export type HealthRecordSource = "manual" | "image" | "voice" | "import" | "ai";

export type AbnormalFlag = "low" | "high" | "critical" | "normal" | "unknown";

export type PersonRelation = "self" | "spouse" | "child" | "parent" | "other";

// ─── App-layer models ─────────────────────────────────────────────────────────

export interface HealthPerson {
  id: string;
  name: string;
  relation: PersonRelation;
  birthDate?: string;
  sex?: "M" | "F" | "O";
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HealthRecord {
  id: string;
  personId: string;
  type: HealthRecordType;
  occurredAt: number;
  title: string;
  summary: string;
  source: HealthRecordSource;
  confidence?: number;
  rawText?: string;
  structuredJson?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HealthAttachment {
  id: string;
  recordId: string;
  filePath: string;
  mimeType: string;
  sha256?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface HealthObservation {
  id: string;
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
  createdAt: number;
}

export interface HealthAiInterpretation {
  id: string;
  recordId: string;
  model: string;
  promptVersion: string;
  resultJson: string;
  summary: string;
  warningsJson: string;
  confidence?: number;
  createdAt: number;
}

// ─── DB row types (snake_case from SQLite) ────────────────────────────────────

export interface DbHealthPerson {
  id: string;
  name: string;
  relation: string;
  birth_date: string | null;
  sex: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbHealthRecord {
  id: string;
  person_id: string;
  type: string;
  occurred_at: number;
  title: string;
  summary: string;
  source: string;
  confidence: number | null;
  raw_text: string | null;
  structured_json: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbHealthAttachment {
  id: string;
  record_id: string;
  file_path: string;
  mime_type: string;
  sha256: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  created_at: number;
}

export interface DbHealthObservation {
  id: string;
  record_id: string;
  person_id: string;
  code: string;
  display_name: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
  abnormal_flag: string | null;
  confidence: number | null;
  observed_at: number;
  created_at: number;
}

export interface DbHealthAiInterpretation {
  id: string;
  record_id: string;
  model: string;
  prompt_version: string;
  result_json: string;
  summary: string;
  warnings_json: string;
  confidence: number | null;
  created_at: number;
}

// ─── AI analysis result types ─────────────────────────────────────────────────

export interface HealthAiObservation {
  code: string;
  displayName: string;
  value?: number;
  valueText?: string;
  unit?: string;
  referenceLow?: number;
  referenceHigh?: number;
  flag?: AbnormalFlag;
  confidence: number;
}

export interface HealthAiResult {
  recordType: HealthRecordType;
  occurredAt?: string;   // ISO date string, e.g. "2026-08-03"
  title?: string;
  summary: string;
  observations: HealthAiObservation[];
  warnings: string[];
  raw: string;           // full raw AI response text
}

// ─── Draft used by the review dialog ─────────────────────────────────────────

export interface HealthImportDraft {
  recordType: HealthRecordType;
  occurredAt: number;     // unix ms
  title: string;
  personId: string;
  aiResult?: HealthAiResult;
  /** Editable list of observations (may be user-modified from AI output). */
  observations: HealthAiObservation[];
}
