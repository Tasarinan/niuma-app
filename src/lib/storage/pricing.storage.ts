import type { PricingConfig, UsageData, ModelPricing, STTPricingConfig } from "@/types";

const PRICING_STORAGE_KEY = "api_pricing_config";
const STT_PRICING_STORAGE_KEY = "stt_pricing_config";

/**
 * Default pricing configuration for known providers.
 * Prices are in USD per 1,000 tokens.
 * Use "*" as a wildcard for model patterns.
 */
export const DEFAULT_PRICING: PricingConfig = {
  openai: {
    "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
    "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
    "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
    "gpt-4": { inputPer1k: 0.03, outputPer1k: 0.06 },
    "gpt-3.5-turbo": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
    "*": { inputPer1k: 0.002, outputPer1k: 0.008 }, // Default for unknown OpenAI models
  },
  claude: {
    // Exact model IDs used in API
    "claude-3-5-sonnet-20241022": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "claude-3-opus-20240229": { inputPer1k: 0.015, outputPer1k: 0.075 },
    "claude-3-sonnet-20240229": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "claude-3-haiku-20240307": { inputPer1k: 0.00025, outputPer1k: 0.00125 },
    // Pattern matches for partial names
    "claude-3-5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
    "claude-3-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },
    "*": { inputPer1k: 0.003, outputPer1k: 0.015 }, // Default for unknown Claude models
  },
  gemini: {
    "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
    "gemini-1.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
    "gemini-pro": { inputPer1k: 0.000125, outputPer1k: 0.000375 },
    "*": { inputPer1k: 0.000125, outputPer1k: 0.000375 },
  },
  groq: {
    // Llama 3.3 models
    "llama-3.3-70b-versatile": { inputPer1k: 0.00059, outputPer1k: 0.00079 },
    "llama-3.3-70b-specdec": { inputPer1k: 0.00059, outputPer1k: 0.00099 },
    // Llama 3.1 models
    "llama-3.1-70b-versatile": { inputPer1k: 0.00059, outputPer1k: 0.00079 },
    "llama-3.1-8b-instant": { inputPer1k: 0.00005, outputPer1k: 0.00008 },
    // Llama 3.2 models (cheap!)
    "llama-3.2-90b-vision-preview": { inputPer1k: 0.0009, outputPer1k: 0.0009 },
    "llama-3.2-11b-vision-preview": { inputPer1k: 0.00018, outputPer1k: 0.00018 },
    "llama-3.2-3b-preview": { inputPer1k: 0.00006, outputPer1k: 0.00006 },
    "llama-3.2-1b-preview": { inputPer1k: 0.00004, outputPer1k: 0.00004 },
    // Gemma models (cheap!)
    "gemma2-9b-it": { inputPer1k: 0.0002, outputPer1k: 0.0002 },
    "gemma-7b-it": { inputPer1k: 0.00007, outputPer1k: 0.00007 },
    // Mixtral
    "mixtral-8x7b-32768": { inputPer1k: 0.00024, outputPer1k: 0.00024 },
    // Llama Guard (free for safety checks)
    "llama-guard-3-8b": { inputPer1k: 0.0002, outputPer1k: 0.0002 },
    // Default for unknown Groq models
    "*": { inputPer1k: 0.0001, outputPer1k: 0.0001 },
  },
  mistral: {
    // Exact model IDs with -latest suffix
    "mistral-large-latest": { inputPer1k: 0.004, outputPer1k: 0.012 },
    "mistral-medium-latest": { inputPer1k: 0.0027, outputPer1k: 0.0081 },
    "mistral-small-latest": { inputPer1k: 0.001, outputPer1k: 0.003 },
    // Mixtral MoE models
    "open-mixtral-8x22b": { inputPer1k: 0.002, outputPer1k: 0.006 },
    "open-mixtral-8x7b": { inputPer1k: 0.0007, outputPer1k: 0.0007 },
    // Pattern matches for partial names
    "mistral-large": { inputPer1k: 0.004, outputPer1k: 0.012 },
    "mistral-medium": { inputPer1k: 0.0027, outputPer1k: 0.0081 },
    "mistral-small": { inputPer1k: 0.001, outputPer1k: 0.003 },
    "*": { inputPer1k: 0.0004, outputPer1k: 0.0012 },
  },
  perplexity: {
    // Online models (with web search)
    "llama-3.1-sonar-large-128k-online": { inputPer1k: 0.001, outputPer1k: 0.001 },
    "llama-3.1-sonar-small-128k-online": { inputPer1k: 0.0002, outputPer1k: 0.0002 },
    // Chat models (no web search)
    "llama-3.1-sonar-large-128k-chat": { inputPer1k: 0.001, outputPer1k: 0.001 },
    "llama-3.1-sonar-small-128k-chat": { inputPer1k: 0.0002, outputPer1k: 0.0002 },
    // Pattern matches
    "llama-3.1-sonar-large": { inputPer1k: 0.001, outputPer1k: 0.001 },
    "llama-3.1-sonar-small": { inputPer1k: 0.0002, outputPer1k: 0.0002 },
    "*": { inputPer1k: 0.001, outputPer1k: 0.001 },
  },
  openrouter: {
    // Popular models via OpenRouter (pricing varies, these are estimates)
    "openai/gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
    "anthropic/claude-3.5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "meta-llama/llama-3.1-70b-instruct": { inputPer1k: 0.00059, outputPer1k: 0.00079 },
    "google/gemini-pro-1.5": { inputPer1k: 0.00125, outputPer1k: 0.005 },
    "mistralai/mistral-large": { inputPer1k: 0.004, outputPer1k: 0.012 },
    // OpenRouter has variable pricing, use a reasonable default
    "*": { inputPer1k: 0.001, outputPer1k: 0.003 },
  },
  cohere: {
    "command-r-plus": { inputPer1k: 0.003, outputPer1k: 0.015 },
    "command-r": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
    "*": { inputPer1k: 0.001, outputPer1k: 0.002 },
  },
  grok: {
    // xAI Grok models
    "grok-2": { inputPer1k: 0.002, outputPer1k: 0.01 },
    "grok-2-mini": { inputPer1k: 0.0002, outputPer1k: 0.001 }, // Very cheap!
    "grok-beta": { inputPer1k: 0.005, outputPer1k: 0.015 },
    "*": { inputPer1k: 0.002, outputPer1k: 0.01 },
  },
  ollama: {
    // Ollama is free (runs locally)
    "llama3.2": { inputPer1k: 0, outputPer1k: 0 },
    "llama3.1": { inputPer1k: 0, outputPer1k: 0 },
    "mistral": { inputPer1k: 0, outputPer1k: 0 },
    "codellama": { inputPer1k: 0, outputPer1k: 0 },
    "phi3": { inputPer1k: 0, outputPer1k: 0 },
    "gemma2": { inputPer1k: 0, outputPer1k: 0 },
    "*": { inputPer1k: 0, outputPer1k: 0 },
  },
  // Default for unknown providers
  "*": {
    "*": { inputPer1k: 0.001, outputPer1k: 0.003 },
  },
};

/**
 * Default STT (Speech-to-Text) pricing configuration.
 * Prices are in USD per minute of audio.
 */
export const DEFAULT_STT_PRICING: STTPricingConfig = {
  // OpenAI Whisper (via openai-whisper provider ID)
  "openai-whisper": {
    "whisper-1": { perMinute: 0.006 },
    "gpt-4o-mini-transcribe": { perMinute: 0.003 }, // Cheaper than Whisper!
    "gpt-4o-transcribe": { perMinute: 0.006 },
    "*": { perMinute: 0.006 },
  },
  // Legacy key for backwards compatibility
  openai: {
    "whisper-1": { perMinute: 0.006 },
    "gpt-4o-mini-transcribe": { perMinute: 0.003 },
    "gpt-4o-transcribe": { perMinute: 0.006 },
    "*": { perMinute: 0.006 },
  },
  // Groq Whisper (very affordable!)
  groq: {
    "whisper-large-v3": { perMinute: 0.000111 },
    "whisper-large-v3-turbo": { perMinute: 0.00004 },
    "distil-whisper-large-v3-en": { perMinute: 0.00002 },
    "*": { perMinute: 0.0001 },
  },
  // ElevenLabs STT
  "elevenlabs-stt": {
    "scribe_v1": { perMinute: 0.01 }, // Estimate
    "*": { perMinute: 0.01 },
  },
  // Google Cloud Speech-to-Text
  "google-stt": {
    "default": { perMinute: 0.006 },
    "latest_long": { perMinute: 0.006 },
    "latest_short": { perMinute: 0.006 },
    "*": { perMinute: 0.006 },
  },
  // Legacy key for backwards compatibility
  google: {
    "*": { perMinute: 0.006 },
  },
  // Deepgram STT
  "deepgram-stt": {
    "nova-2": { perMinute: 0.0043 },
    "nova": { perMinute: 0.0043 },
    "enhanced": { perMinute: 0.0145 },
    "base": { perMinute: 0.0125 },
    "*": { perMinute: 0.0043 },
  },
  // Legacy key for backwards compatibility
  deepgram: {
    "nova-2": { perMinute: 0.0043 },
    "nova": { perMinute: 0.0043 },
    "enhanced": { perMinute: 0.0145 },
    "base": { perMinute: 0.0125 },
    "*": { perMinute: 0.0043 },
  },
  // Azure Speech Services
  "azure-stt": {
    "default": { perMinute: 0.01 },
    "*": { perMinute: 0.01 },
  },
  // Legacy key for backwards compatibility
  azure: {
    "*": { perMinute: 0.01 },
  },
  // Speechmatics STT
  "speechmatics-stt": {
    "default": { perMinute: 0.012 }, // ~$0.72/hour
    "*": { perMinute: 0.012 },
  },
  // Rev.ai STT
  "rev-ai-stt": {
    "default": { perMinute: 0.02 }, // $0.02/min for async
    "*": { perMinute: 0.02 },
  },
  // IBM Watson STT
  "ibm-watson-stt": {
    "default": { perMinute: 0.02 }, // ~$0.02/min
    "*": { perMinute: 0.02 },
  },
  // AssemblyAI (with diarization)
  "assemblyai-diarization": {
    "best": { perMinute: 0.00617 },
    "nano": { perMinute: 0.002 },
    "*": { perMinute: 0.00617 },
  },
  // Legacy key for backwards compatibility
  assemblyai: {
    "best": { perMinute: 0.00617 },
    "nano": { perMinute: 0.002 },
    "universal": { perMinute: 0.0025 },
    "universal-diarization": { perMinute: 0.00283 },
    "*": { perMinute: 0.00283 },
  },
  // Default for unknown STT providers
  "*": {
    "*": { perMinute: 0.006 },
  },
};

/**
 * Gets the current pricing configuration from localStorage,
 * or returns the default if none is stored.
 */
export function getPricingConfig(): PricingConfig {
  try {
    const stored = localStorage.getItem(PRICING_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure new providers are included
      return { ...DEFAULT_PRICING, ...parsed };
    }
    return DEFAULT_PRICING;
  } catch (error) {
    console.error("Failed to load pricing config:", error);
    return DEFAULT_PRICING;
  }
}

/**
 * Saves a custom pricing configuration to localStorage.
 */
export function setPricingConfig(config: PricingConfig): void {
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save pricing config:", error);
  }
}

/**
 * Updates pricing for a specific provider.
 */
export function updateProviderPricing(
  providerId: string,
  pricing: { [modelPattern: string]: ModelPricing }
): PricingConfig {
  const current = getPricingConfig();
  const updated = {
    ...current,
    [providerId]: {
      ...current[providerId],
      ...pricing,
    },
  };
  setPricingConfig(updated);
  return updated;
}

/**
 * Resets pricing to defaults.
 */
export function resetPricingConfig(): void {
  localStorage.removeItem(PRICING_STORAGE_KEY);
}

/**
 * Gets the pricing for a specific provider and model.
 * Falls back to wildcard patterns if exact match not found.
 */
export function getModelPricing(
  providerId: string,
  model: string
): ModelPricing {
  const config = getPricingConfig();

  // Try exact provider match
  const providerPricing = config[providerId] || config["*"];

  if (!providerPricing) {
    return { inputPer1k: 0.001, outputPer1k: 0.003 }; // Fallback
  }

  // Try exact model match
  if (providerPricing[model]) {
    return providerPricing[model];
  }

  // Try partial match (model name starts with pattern)
  for (const pattern of Object.keys(providerPricing)) {
    if (pattern !== "*" && model.toLowerCase().includes(pattern.toLowerCase())) {
      return providerPricing[pattern];
    }
  }

  // Fall back to wildcard
  return providerPricing["*"] || { inputPer1k: 0.001, outputPer1k: 0.003 };
}

/**
 * Calculates the estimated cost for a given usage.
 */
export function calculateCost(
  usage: UsageData,
  providerId: string,
  model: string
): number {
  const pricing = getModelPricing(providerId, model);

  const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1k;
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1k;

  return inputCost + outputCost;
}

/**
 * Formats a cost value as a currency string.
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Gets the STT pricing configuration from localStorage,
 * or returns the default if none is stored.
 */
export function getSTTPricingConfig(): STTPricingConfig {
  try {
    const stored = localStorage.getItem(STT_PRICING_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_STT_PRICING, ...parsed };
    }
    return DEFAULT_STT_PRICING;
  } catch (error) {
    console.error("Failed to load STT pricing config:", error);
    return DEFAULT_STT_PRICING;
  }
}

/**
 * Gets the STT pricing for a specific provider and model.
 */
export function getSTTModelPricing(
  providerId: string,
  model: string
): { perMinute: number } {
  const config = getSTTPricingConfig();
  const providerPricing = config[providerId] || config["*"];

  if (!providerPricing) {
    return { perMinute: 0.006 }; // Fallback to Whisper pricing
  }

  // Try exact model match
  if (providerPricing[model]) {
    return providerPricing[model];
  }

  // Try partial match
  for (const pattern of Object.keys(providerPricing)) {
    if (pattern !== "*" && model.toLowerCase().includes(pattern.toLowerCase())) {
      return providerPricing[pattern];
    }
  }

  return providerPricing["*"] || { perMinute: 0.006 };
}

/**
 * Calculates the estimated cost for STT usage.
 */
export function calculateSTTCost(
  audioSeconds: number,
  providerId: string,
  model: string
): number {
  const pricing = getSTTModelPricing(providerId, model);
  const minutes = audioSeconds / 60;
  return minutes * pricing.perMinute;
}
