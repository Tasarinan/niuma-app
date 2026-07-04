// API Usage and Cost Tracking Types

export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  audioSeconds?: number; // For STT usage (e.g., Whisper)
}

export interface ApiUsageRecord {
  id: string;
  conversationId: string;
  messageId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  audioSeconds?: number; // For STT usage
  estimatedCost: number;
  timestamp: number;
}

export interface ProviderCostBreakdown {
  cost: number;
  tokens: number;
  audioSeconds: number;
  requests: number;
}

export interface DailyCostData {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  byProvider: Record<string, ProviderCostBreakdown>;
  dailyTotals: DailyCostData[];
}

export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

// STT pricing (per minute of audio)
export interface STTPricing {
  perMinute: number;
}

export interface STTProviderPricing {
  [modelPattern: string]: STTPricing;
}

export interface STTPricingConfig {
  [providerId: string]: STTProviderPricing;
}

export interface ProviderPricing {
  [modelPattern: string]: ModelPricing;
}

export interface PricingConfig {
  [providerId: string]: ProviderPricing;
}

// Database row types (snake_case to match SQLite)
export interface DbApiUsageRecord {
  id: string;
  conversation_id: string;
  message_id: string | null;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  audio_seconds: number | null;
  estimated_cost: number | null;
  timestamp: number;
}
