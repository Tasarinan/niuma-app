export type ContentEntryType = "idea" | "note" | "clip" | "quote" | "diary" | "collect";

export type ContentEntrySource = "manual" | "url" | "file";

export interface ContentProfile {
  id: string;
  version: number;
  structured: Record<string, string>;
  createdAt: number;
}

export interface ContentEntry {
  id: string;
  type: ContentEntryType;
  occurredAt: number;
  title: string;
  summary: string;
  rawText?: string;
  source: ContentEntrySource;
  sourceRef?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DbContentProfile {
  id: string;
  version: number;
  structured_json: string;
  created_at: number;
}

export interface DbContentEntry {
  id: string;
  type: string;
  occurred_at: number;
  title: string;
  summary: string;
  raw_text: string | null;
  source: string;
  source_ref: string | null;
  tags_json: string;
  created_at: number;
  updated_at: number;
}
