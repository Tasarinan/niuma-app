import { getDatabase } from "./config";
import type {
  ApiUsageRecord,
  DbApiUsageRecord,
  CostSummary,
  DailyCostData,
} from "@/types";

/**
 * Validates an API usage record before database operations
 */
function validateUsageRecord(record: ApiUsageRecord): boolean {
  if (!record.id || typeof record.id !== "string") {
    console.error("Invalid usage record: missing or invalid id");
    return false;
  }
  if (!record.conversationId || typeof record.conversationId !== "string") {
    console.error("Invalid usage record: missing or invalid conversationId");
    return false;
  }
  if (!record.provider || typeof record.provider !== "string") {
    console.error("Invalid usage record: missing or invalid provider");
    return false;
  }
  if (!record.model || typeof record.model !== "string") {
    console.error("Invalid usage record: missing or invalid model");
    return false;
  }
  if (typeof record.timestamp !== "number" || record.timestamp <= 0) {
    console.error("Invalid usage record: invalid timestamp");
    return false;
  }
  return true;
}

/**
 * Converts a database row to an ApiUsageRecord
 */
function dbRowToRecord(row: DbApiUsageRecord): ApiUsageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id || undefined,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens || 0,
    outputTokens: row.output_tokens || 0,
    totalTokens: row.total_tokens || 0,
    audioSeconds: row.audio_seconds || undefined,
    estimatedCost: row.estimated_cost || 0,
    timestamp: row.timestamp,
  };
}

/**
 * Creates a new API usage record in the database
 */
export async function createUsageRecord(
  record: ApiUsageRecord
): Promise<ApiUsageRecord> {
  if (!validateUsageRecord(record)) {
    throw new Error("Invalid usage record data");
  }

  const db = await getDatabase();

  try {
    await db.execute(
      `INSERT INTO api_usage (
        id, conversation_id, message_id, provider, model,
        input_tokens, output_tokens, total_tokens, audio_seconds, estimated_cost, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.conversationId,
        record.messageId || null,
        record.provider,
        record.model,
        record.inputTokens,
        record.outputTokens,
        record.totalTokens,
        record.audioSeconds || null,
        record.estimatedCost,
        record.timestamp,
      ]
    );

    return record;
  } catch (error) {
    console.error("Failed to create usage record:", error);
    throw error;
  }
}

/**
 * Gets all usage records for a specific conversation
 */
export async function getUsageByConversation(
  conversationId: string
): Promise<ApiUsageRecord[]> {
  if (!conversationId || typeof conversationId !== "string") {
    console.error("Invalid conversation id");
    return [];
  }

  const db = await getDatabase();

  try {
    const records = await db.select<DbApiUsageRecord[]>(
      `SELECT * FROM api_usage WHERE conversation_id = ? ORDER BY timestamp DESC`,
      [conversationId]
    );

    return records.map(dbRowToRecord);
  } catch (error) {
    console.error(
      `Failed to get usage for conversation ${conversationId}:`,
      error
    );
    return [];
  }
}

/**
 * Gets all usage records within an optional date range
 */
export async function getAllUsageRecords(
  startDate?: number,
  endDate?: number
): Promise<ApiUsageRecord[]> {
  const db = await getDatabase();

  try {
    let query = `SELECT * FROM api_usage`;
    const params: number[] = [];

    if (startDate !== undefined && endDate !== undefined) {
      query += ` WHERE timestamp >= ? AND timestamp <= ?`;
      params.push(startDate, endDate);
    } else if (startDate !== undefined) {
      query += ` WHERE timestamp >= ?`;
      params.push(startDate);
    } else if (endDate !== undefined) {
      query += ` WHERE timestamp <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC`;

    const records = await db.select<DbApiUsageRecord[]>(query, params);
    return records.map(dbRowToRecord);
  } catch (error) {
    console.error("Failed to get usage records:", error);
    return [];
  }
}

/**
 * Gets aggregated cost summary with optional date range filtering
 */
export async function getCostSummary(
  startDate?: number,
  endDate?: number
): Promise<CostSummary> {
  const records = await getAllUsageRecords(startDate, endDate);

  const summary: CostSummary = {
    totalCost: 0,
    totalTokens: 0,
    totalRequests: records.length,
    byProvider: {},
    dailyTotals: [],
  };

  const dailyMap = new Map<string, DailyCostData>();

  for (const record of records) {
    // Totals
    summary.totalCost += record.estimatedCost;
    summary.totalTokens += record.totalTokens;

    // By provider
    if (!summary.byProvider[record.provider]) {
      summary.byProvider[record.provider] = { cost: 0, tokens: 0, audioSeconds: 0, requests: 0 };
    }
    summary.byProvider[record.provider].cost += record.estimatedCost;
    summary.byProvider[record.provider].tokens += record.totalTokens;
    summary.byProvider[record.provider].audioSeconds += record.audioSeconds || 0;
    summary.byProvider[record.provider].requests += 1;

    // Daily totals
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, cost: 0, tokens: 0, requests: 0 });
    }
    const daily = dailyMap.get(date)!;
    daily.cost += record.estimatedCost;
    daily.tokens += record.totalTokens;
    daily.requests += 1;
  }

  // Convert daily map to sorted array
  summary.dailyTotals = Array.from(dailyMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return summary;
}

/**
 * Gets daily cost data for the last N days (for charts)
 */
export async function getDailyCosts(days: number = 30): Promise<DailyCostData[]> {
  const now = new Date();
  // Set to start of today
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = today.getTime() + 24 * 60 * 60 * 1000; // End of today
  const startDate = today.getTime() - (days - 1) * 24 * 60 * 60 * 1000; // Start of (days-1) days ago

  const summary = await getCostSummary(startDate, endDate);

  // Fill in missing days with zero values (including today)
  const result: DailyCostData[] = [];
  const existingDates = new Set(summary.dailyTotals.map((d) => d.date));

  for (let i = 0; i < days; i++) {
    const dateObj = new Date(startDate + i * 24 * 60 * 60 * 1000);
    const date = dateObj.toISOString().split("T")[0];

    if (existingDates.has(date)) {
      const existing = summary.dailyTotals.find((d) => d.date === date);
      if (existing) {
        result.push(existing);
      }
    } else {
      result.push({ date, cost: 0, tokens: 0, requests: 0 });
    }
  }

  return result;
}

/**
 * Gets cost summary for a specific conversation
 */
export async function getConversationCostSummary(
  conversationId: string
): Promise<{ totalCost: number; totalTokens: number; requestCount: number }> {
  const records = await getUsageByConversation(conversationId);

  return {
    totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
    totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
    requestCount: records.length,
  };
}

/**
 * Deletes all usage records for a conversation (called when conversation is deleted)
 */
export async function deleteUsageByConversation(
  conversationId: string
): Promise<boolean> {
  if (!conversationId || typeof conversationId !== "string") {
    console.error("Invalid conversation id");
    return false;
  }

  const db = await getDatabase();

  try {
    await db.execute(`DELETE FROM api_usage WHERE conversation_id = ?`, [
      conversationId,
    ]);
    return true;
  } catch (error) {
    console.error(
      `Failed to delete usage for conversation ${conversationId}:`,
      error
    );
    return false;
  }
}

/**
 * Gets the total cost for the current month
 */
export async function getCurrentMonthCost(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const summary = await getCostSummary(startOfMonth);
  return summary.totalCost;
}
