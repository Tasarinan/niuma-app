import { fetchAIResponse } from "./ai-response.function";
import { TYPE_PROVIDER } from "@/types";

export interface TranslationParams {
  text: string;
  targetLanguage: string;
  targetLanguageName: string;
  provider: TYPE_PROVIDER | undefined;
  selectedProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  signal?: AbortSignal;
}

export interface TranslationResult {
  success: boolean;
  translation?: string;
  error?: string;
}

/**
 * Translates text using the configured AI provider.
 * Returns the complete translation as a string.
 */
export async function translateText(
  params: TranslationParams
): Promise<TranslationResult> {
  const { text, targetLanguageName, provider, selectedProvider, signal } =
    params;

  const translationPrompt = `Translate the following text to ${targetLanguageName}.
Only output the translation, nothing else. Do not include explanations or notes.

Text to translate:
${text}`;

  try {
    let translation = "";

    for await (const chunk of fetchAIResponse({
      provider,
      selectedProvider,
      systemPrompt:
        "You are a professional translator. Only output the translation, nothing else.",
      history: [],
      userMessage: translationPrompt,
      imagesBase64: [],
      signal,
    })) {
      if (signal?.aborted) {
        return { success: false, error: "Translation cancelled" };
      }
      translation += chunk;
    }

    return {
      success: true,
      translation: translation.trim(),
    };
  } catch (error) {
    console.error("Translation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Translation failed",
    };
  }
}
