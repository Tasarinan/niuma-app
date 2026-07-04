/**
 * Model configurations for AI and STT providers.
 * Used to populate model dropdowns in the Dev Space settings.
 */

export interface ModelOption {
  id: string;
  name: string;
  recommended?: boolean;
  description?: string;
}

export interface ProviderInfo {
  name: string;
  signupUrl: string;
  pricingUrl?: string;
  description: string;
}

/**
 * AI provider information including signup and pricing URLs.
 */
export const AI_PROVIDER_INFO: Record<string, ProviderInfo> = {
  openai: {
    name: "OpenAI",
    signupUrl: "https://platform.openai.com/signup",
    pricingUrl: "https://openai.com/api/pricing",
    description: "Get your API key and credits from OpenAI",
  },
  claude: {
    name: "Anthropic",
    signupUrl: "https://console.anthropic.com/",
    pricingUrl: "https://www.anthropic.com/pricing#anthropic-api",
    description: "Get your API key and credits from Anthropic",
  },
  grok: {
    name: "xAI",
    signupUrl: "https://console.x.ai/",
    pricingUrl: "https://x.ai/api",
    description: "Get your API key from xAI",
  },
  gemini: {
    name: "Google AI Studio",
    signupUrl: "https://aistudio.google.com/apikey",
    pricingUrl: "https://ai.google.dev/pricing",
    description: "Get your API key from Google AI Studio",
  },
  mistral: {
    name: "Mistral AI",
    signupUrl: "https://console.mistral.ai/",
    pricingUrl: "https://mistral.ai/technology/#pricing",
    description: "Get your API key and credits from Mistral AI",
  },
  cohere: {
    name: "Cohere",
    signupUrl: "https://dashboard.cohere.com/welcome/register",
    pricingUrl: "https://cohere.com/pricing",
    description: "Get your API key and credits from Cohere",
  },
  groq: {
    name: "Groq",
    signupUrl: "https://console.groq.com/keys",
    pricingUrl: "https://groq.com/pricing/",
    description: "Get your API key from Groq (generous free tier!)",
  },
  perplexity: {
    name: "Perplexity",
    signupUrl: "https://www.perplexity.ai/settings/api",
    pricingUrl: "https://docs.perplexity.ai/guides/pricing",
    description: "Get your API key and credits from Perplexity",
  },
  openrouter: {
    name: "OpenRouter",
    signupUrl: "https://openrouter.ai/keys",
    pricingUrl: "https://openrouter.ai/models",
    description: "Access multiple AI providers through one API",
  },
  ollama: {
    name: "Ollama",
    signupUrl: "https://ollama.com/download",
    description: "Download and run models locally for free",
  },
};

/**
 * STT provider information including signup and pricing URLs.
 */
export const STT_PROVIDER_INFO: Record<string, ProviderInfo> = {
  "openai-whisper": {
    name: "OpenAI Whisper",
    signupUrl: "https://platform.openai.com/signup",
    pricingUrl: "https://openai.com/api/pricing",
    description: "Get your API key from OpenAI",
  },
  groq: {
    name: "Groq Whisper",
    signupUrl: "https://console.groq.com/keys",
    pricingUrl: "https://groq.com/pricing/",
    description: "Get your API key from Groq (very affordable!)",
  },
  "elevenlabs-stt": {
    name: "ElevenLabs",
    signupUrl: "https://elevenlabs.io/app/sign-up",
    pricingUrl: "https://elevenlabs.io/pricing",
    description: "Get your API key from ElevenLabs",
  },
  "google-stt": {
    name: "Google Cloud Speech",
    signupUrl: "https://console.cloud.google.com/apis/credentials",
    pricingUrl: "https://cloud.google.com/speech-to-text/pricing",
    description: "Get your API key from Google Cloud Console",
  },
  "deepgram-stt": {
    name: "Deepgram",
    signupUrl: "https://console.deepgram.com/signup",
    pricingUrl: "https://deepgram.com/pricing",
    description: "Get your API key from Deepgram",
  },
  "azure-stt": {
    name: "Azure Speech Services",
    signupUrl: "https://azure.microsoft.com/en-us/products/ai-services/speech-to-text",
    pricingUrl: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/",
    description: "Get your API key from Azure Portal",
  },
  "speechmatics-stt": {
    name: "Speechmatics",
    signupUrl: "https://portal.speechmatics.com/signup",
    pricingUrl: "https://www.speechmatics.com/pricing",
    description: "Get your API key from Speechmatics",
  },
  "rev-ai-stt": {
    name: "Rev.ai",
    signupUrl: "https://www.rev.ai/auth/signup",
    pricingUrl: "https://www.rev.ai/pricing",
    description: "Get your API key from Rev.ai",
  },
  "ibm-watson-stt": {
    name: "IBM Watson",
    signupUrl: "https://cloud.ibm.com/catalog/services/speech-to-text",
    pricingUrl: "https://www.ibm.com/products/speech-to-text/pricing",
    description: "Get your API key from IBM Cloud",
  },
  "assemblyai-diarization": {
    name: "AssemblyAI",
    signupUrl: "https://www.assemblyai.com/app/signup",
    pricingUrl: "https://www.assemblyai.com/pricing",
    description: "Get your API key from AssemblyAI",
  },
};

/**
 * Get provider info for an AI provider.
 */
export function getAIProviderInfo(providerId: string): ProviderInfo | null {
  return AI_PROVIDER_INFO[providerId] || null;
}

/**
 * Get provider info for an STT provider.
 */
export function getSTTProviderInfo(providerId: string): ProviderInfo | null {
  return STT_PROVIDER_INFO[providerId] || null;
}

/**
 * AI model options per provider.
 * Models are ordered by recommendation/popularity.
 */
export const AI_MODELS: Record<string, ModelOption[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4 Omni", recommended: true, description: "Most capable, multimodal" },
    { id: "gpt-4o-mini", name: "GPT-4 Omni Mini", description: "Fast and affordable" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High capability, faster than GPT-4" },
    { id: "gpt-4", name: "GPT-4", description: "Original GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast, cost-effective" },
  ],
  claude: [
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", recommended: true, description: "Latest, excellent balance of speed and quality" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Highest capability" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", description: "Good balance" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest, most affordable" },
  ],
  grok: [
    { id: "grok-2", name: "Grok 2", recommended: true, description: "Most capable xAI model" },
    { id: "grok-2-mini", name: "Grok 2 Mini", description: "Fast and affordable" },
    { id: "grok-beta", name: "Grok Beta", description: "Beta version" },
  ],
  gemini: [
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", recommended: true, description: "Best quality, long context" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast and affordable" },
    { id: "gemini-pro", name: "Gemini Pro", description: "Standard Gemini model" },
  ],
  mistral: [
    { id: "mistral-large-latest", name: "Mistral Large", recommended: true, description: "Most capable" },
    { id: "mistral-medium-latest", name: "Mistral Medium", description: "Balanced performance" },
    { id: "mistral-small-latest", name: "Mistral Small", description: "Fast and efficient" },
    { id: "open-mixtral-8x22b", name: "Mixtral 8x22B", description: "Open-source MoE model" },
    { id: "open-mixtral-8x7b", name: "Mixtral 8x7B", description: "Open-source MoE model" },
  ],
  cohere: [
    { id: "command-r-plus", name: "Command R+", recommended: true, description: "Most capable" },
    { id: "command-r", name: "Command R", description: "Balanced performance" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", recommended: true, description: "Latest Llama, versatile" },
    { id: "llama-3.3-70b-specdec", name: "Llama 3.3 70B SpecDec", description: "Speculative decoding" },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Large, capable model" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Fast, efficient" },
    { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B Vision", description: "Multimodal" },
    { id: "llama-3.2-11b-vision-preview", name: "Llama 3.2 11B Vision", description: "Multimodal, efficient" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Open-source MoE" },
    { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Google's open model" },
  ],
  perplexity: [
    { id: "llama-3.1-sonar-large-128k-online", name: "Sonar Large", recommended: true, description: "Best quality with web search" },
    { id: "llama-3.1-sonar-small-128k-online", name: "Sonar Small", description: "Fast with web search" },
    { id: "llama-3.1-sonar-large-128k-chat", name: "Sonar Large Chat", description: "No web search" },
    { id: "llama-3.1-sonar-small-128k-chat", name: "Sonar Small Chat", description: "Fast, no web search" },
  ],
  openrouter: [
    { id: "openai/gpt-4o", name: "OpenAI GPT-4o", recommended: true, description: "Via OpenRouter" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Via OpenRouter" },
    { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", description: "Via OpenRouter" },
    { id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro", description: "Via OpenRouter" },
    { id: "mistralai/mistral-large", name: "Mistral Large", description: "Via OpenRouter" },
  ],
  ollama: [
    { id: "llama3.2", name: "Llama 3.2", recommended: true, description: "Latest Llama" },
    { id: "llama3.1", name: "Llama 3.1", description: "Popular choice" },
    { id: "mistral", name: "Mistral", description: "Fast and capable" },
    { id: "codellama", name: "Code Llama", description: "Optimized for code" },
    { id: "phi3", name: "Phi-3", description: "Microsoft small model" },
    { id: "gemma2", name: "Gemma 2", description: "Google's open model" },
  ],
};

/**
 * STT model options per provider.
 * Models are ordered by recommendation/popularity.
 */
export const STT_MODELS: Record<string, ModelOption[]> = {
  "openai-whisper": [
    { id: "whisper-1", name: "Whisper V1", recommended: true, description: "Standard Whisper model" },
    { id: "gpt-4o-transcribe", name: "GPT-4o Transcribe", description: "High accuracy transcription" },
    { id: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe", description: "Fast and affordable" },
  ],
  groq: [
    { id: "whisper-large-v3", name: "Whisper Large V3", recommended: true, description: "Best accuracy" },
    { id: "whisper-large-v3-turbo", name: "Whisper Large V3 Turbo", description: "Faster variant" },
    { id: "distil-whisper-large-v3-en", name: "Distil Whisper (English)", description: "Fast, English only" },
  ],
  "elevenlabs-stt": [
    { id: "scribe_v1", name: "Scribe V1", recommended: true, description: "ElevenLabs STT model" },
  ],
  "google-stt": [
    { id: "default", name: "Default", recommended: true, description: "Google Cloud STT" },
    { id: "latest_long", name: "Latest Long", description: "Optimized for long audio" },
    { id: "latest_short", name: "Latest Short", description: "Optimized for short audio" },
  ],
  "deepgram-stt": [
    { id: "nova-2", name: "Nova 2", recommended: true, description: "Latest, most accurate" },
    { id: "nova", name: "Nova", description: "Previous generation" },
    { id: "enhanced", name: "Enhanced", description: "Higher accuracy" },
    { id: "base", name: "Base", description: "Standard accuracy" },
  ],
  "azure-stt": [
    { id: "default", name: "Default", recommended: true, description: "Azure Speech Services" },
  ],
  "speechmatics-stt": [
    { id: "default", name: "Default", recommended: true, description: "Speechmatics STT" },
  ],
  "rev-ai-stt": [
    { id: "default", name: "Default", recommended: true, description: "Rev.ai STT" },
  ],
  "ibm-watson-stt": [
    { id: "default", name: "Default", recommended: true, description: "IBM Watson STT" },
  ],
  "assemblyai-diarization": [
    { id: "best", name: "Best", recommended: true, description: "Highest accuracy" },
    { id: "nano", name: "Nano", description: "Fastest, lower cost" },
  ],
};

/**
 * Get models for a specific AI provider.
 * Returns empty array if provider not found.
 */
export function getAIModelsForProvider(providerId: string): ModelOption[] {
  return AI_MODELS[providerId] || [];
}

/**
 * Get models for a specific STT provider.
 * Returns empty array if provider not found.
 */
export function getSTTModelsForProvider(providerId: string): ModelOption[] {
  return STT_MODELS[providerId] || [];
}

/**
 * Check if a provider has predefined models.
 */
export function hasModelsForProvider(providerId: string, type: "ai" | "stt"): boolean {
  if (type === "ai") {
    return providerId in AI_MODELS && AI_MODELS[providerId].length > 0;
  }
  return providerId in STT_MODELS && STT_MODELS[providerId].length > 0;
}
