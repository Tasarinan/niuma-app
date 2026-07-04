import { useCallback, useRef } from "react";
import { useApp } from "@/contexts";
import { translateText, TranslationResult } from "@/lib";
import { STT_LANGUAGES } from "@/config";

export const useTranslation = () => {
  const {
    sttTranslationEnabled,
    sttTranslationLanguage,
    selectedAIProvider,
    allAiProviders,
  } = useApp();

  const abortControllerRef = useRef<AbortController | null>(null);

  const getLanguageName = useCallback((code: string) => {
    const lang = STT_LANGUAGES.find((l) => l.code === code);
    return lang?.name || code;
  }, []);

  const translate = useCallback(
    async (text: string): Promise<TranslationResult> => {
      if (!sttTranslationEnabled) {
        return { success: false, error: "Translation disabled" };
      }

      if (!text.trim()) {
        return { success: false, error: "Empty text" };
      }

      // Cancel any pending translation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const provider = allAiProviders.find(
        (p) => p.id === selectedAIProvider.provider
      );

      return translateText({
        text,
        targetLanguage: sttTranslationLanguage,
        targetLanguageName: getLanguageName(sttTranslationLanguage),
        provider,
        selectedProvider: selectedAIProvider,
        signal: abortControllerRef.current.signal,
      });
    },
    [
      sttTranslationEnabled,
      sttTranslationLanguage,
      selectedAIProvider,
      allAiProviders,
      getLanguageName,
    ]
  );

  const cancelTranslation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    translate,
    cancelTranslation,
    isEnabled: sttTranslationEnabled,
    targetLanguage: sttTranslationLanguage,
    targetLanguageName: getLanguageName(sttTranslationLanguage),
  };
};
