import {
  deepVariableReplacer,
  getByPath,
  blobToBase64,
} from "./common.function";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";

import { TYPE_PROVIDER, TranscriptEntry, SpeakerInfo } from "@/types";
import curl2Json from "@bany/curl-to-json";
import { shouldUseNiumaAPI } from "./Niuma.api";
import {
  fetchAssemblyAIWithDiarization,
  AssemblyAIUtterance,
} from "./assemblyai.function";
import { STT_LANGUAGES } from "@/config";

/**
 * Validates and sanitizes a language code to prevent injection attacks.
 * Only allows "auto", empty string, or valid ISO 639-1 codes from STT_LANGUAGES.
 *
 * @param language - The language code to validate
 * @returns Sanitized language code, or "en" if invalid
 */
function sanitizeLanguageCode(language: string | undefined): string {
  // Allow "auto" for auto-detection
  if (language === "auto") {
    return "auto";
  }

  // Allow empty string for auto-detection
  if (!language || language === "") {
    return "";
  }

  // Validate against whitelist of known language codes
  const validCodes: string[] = STT_LANGUAGES.map((lang) => lang.code);
  if (validCodes.includes(language)) {
    return language;
  }

  // Additional regex check for ISO 639-1 format as a safety net
  // Matches: "en", "es", "zh", etc. (2 lowercase letters)
  const iso639Pattern = /^[a-z]{2}$/;
  if (iso639Pattern.test(language)) {
    console.warn(`[STT] Language code "${language}" not in whitelist but matches ISO 639-1 format`);
    return language;
  }

  // Invalid language code - log warning and fall back to English
  console.warn(`[STT] Invalid language code "${language}" rejected, falling back to "en"`);
  return "en";
}

/**
 * Estimates audio duration from a Blob.
 * For WAV files, calculates from headers. For others, estimates from file size.
 */
async function estimateAudioDuration(audio: Blob): Promise<number> {
  try {
    // For WAV files, we can calculate duration from headers
    if (audio.type === "audio/wav" || audio.type === "audio/wave") {
      const buffer = await audio.arrayBuffer();
      const view = new DataView(buffer);
      // WAV header: bytes 28-31 contain byte rate
      const byteRate = view.getInt32(28, true);
      if (byteRate > 0) {
        // Data size is approximately (file size - 44 bytes header)
        const dataSize = buffer.byteLength - 44;
        return dataSize / byteRate;
      }
    }

    // Fallback: estimate based on file size (assuming ~16kbps for speech audio)
    // This is a rough estimate, actual duration may vary
    const bytesPerSecond = 16000 / 8; // 16kbps = 2000 bytes/sec
    return audio.size / bytesPerSecond;
  } catch (error) {
    console.warn("Failed to estimate audio duration:", error);
    // Default to a small estimate if we can't calculate
    return audio.size / 2000;
  }
}

/**
 * Emits an STT usage event for cost tracking.
 */
function emitSTTUsage(
  provider: string,
  model: string,
  audioSeconds: number
): void {
  console.log("[Cost Tracking STT] Emitting stt-usage-captured event:", { provider, model, audioSeconds });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("stt-usage-captured", {
        detail: {
          provider,
          model,
          audioSeconds,
        },
      })
    );
  }
}

// Niuma STT function
async function fetchNiumaSTT(audio: File | Blob): Promise<string> {
  try {
    // Convert audio to base64
    const audioBase64 = await blobToBase64(audio);

    // Call Tauri command
    const response = await invoke<{
      success: boolean;
      transcription?: string;
      error?: string;
    }>("transcribe_audio", {
      audioBase64,
    });

    if (response.success && response.transcription) {
      return response.transcription;
    } else {
      return response.error || "Transcription failed";
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Niuma STT Error: ${errorMessage}`;
  }
}

/**
 * Parameters for STT transcription.
 */
export interface STTParams {
  /** The STT provider configuration */
  provider: TYPE_PROVIDER | undefined;
  /** Selected provider with API credentials */
  selectedProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  /** Audio file to transcribe */
  audio: File | Blob;
  /**
   * Language code for speech recognition.
   * - ISO 639-1 code (e.g., "en", "es", "fr") for specific language
   * - "auto" for automatic language detection (provider-dependent)
   * - undefined defaults to "en" for template-based providers, or auto-detect for AssemblyAI
   *
   * Note: Auto-detect support varies by provider. Template-based providers receive an empty
   * string which most interpret as auto-detect. AssemblyAI omits the language_code field.
   */
  language?: string;
}

/**
 * Transcribes audio using the configured STT provider.
 *
 * @param params - The STT parameters including provider, audio, and language settings
 * @returns The transcribed text, or an error message if transcription fails
 *
 * @example
 * // With specific language
 * const text = await fetchSTT({ provider, selectedProvider, audio, language: "en" });
 *
 * @example
 * // With auto-detect
 * const text = await fetchSTT({ provider, selectedProvider, audio, language: "auto" });
 */
export async function fetchSTT(params: STTParams): Promise<string> {
  let warnings: string[] = [];

  try {
    const { provider, selectedProvider, audio, language } = params;

    // Check if we should use Niuma API instead
    const useNiumaAPI = await shouldUseNiumaAPI();
    if (useNiumaAPI) {
      return await fetchNiumaSTT(audio);
    }

    if (!provider) throw new Error("Provider not provided");
    if (!selectedProvider) throw new Error("Selected provider not provided");
    if (!audio) throw new Error("Audio file is required");

    // Validate language compatibility with provider
    const isAutoDetect = language === "auto" || language === "" || language === undefined;
    if (isAutoDetect && provider.supportsAutoDetect === false) {
      const providerName = provider.name || provider.id || "This provider";
      console.warn(
        `[STT] Warning: ${providerName} may not support auto-detect language. ` +
        `Consider selecting a specific language for better accuracy.`
      );
      warnings.push(`Language auto-detect may not be fully supported by ${providerName}`);
    }

    // Check if provider requires special handling (e.g., AssemblyAI with diarization)
    if (provider.requiresSpecialHandler && provider.specialHandler === "assemblyai-diarization") {
      // Check for API key in both cases (api_key and API_KEY)
      const apiKey = selectedProvider.variables?.API_KEY || selectedProvider.variables?.api_key;
      if (!apiKey) {
        console.error("[STT] AssemblyAI variables:", selectedProvider.variables);
        throw new Error("AssemblyAI API key is required");
      }

      console.log("[STT] Using AssemblyAI special handler for diarization");
      // AssemblyAI uses undefined for auto-detection (omits language_code from request body)
      // This differs from template-based providers which use empty string in URL/form params
      // AssemblyAI's API: when language_code is omitted, it auto-detects the language
      // SECURITY: Sanitize language code before passing to API
      const sanitizedLang = sanitizeLanguageCode(language);
      const effectiveLang = (!sanitizedLang || sanitizedLang === "auto") ? undefined : sanitizedLang;
      const result = await fetchAssemblyAIWithDiarization(audio, {
        apiKey,
        language: effectiveLang,
      });

      // Return just the transcription text for compatibility
      return result.transcription;
    }

    let curlJson: any;
    try {
      curlJson = curl2Json(provider.curl);
    } catch (error) {
      throw new Error(
        `Failed to parse curl: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Validate audio file
    const file = audio as File;
    if (file.size === 0) throw new Error("Audio file is empty");
    // maximum size of 10MB
    // const maxSize = 10 * 1024 * 1024;
    // if (file.size > maxSize) {
    //   warnings.push("Audio exceeds 10MB limit");
    // }

    // Build variable map
    // Template-based providers (OpenAI, Groq, Deepgram, etc.) use CURL templates with {{LANGUAGE}}
    // - "auto" â†?empty string: most providers auto-detect when language param is empty
    // - undefined â†?"en": safe fallback for providers that require a language code
    // Note: This differs from AssemblyAI which uses undefined to omit the language_code field entirely
    // SECURITY: Sanitize language code to prevent injection attacks in CURL templates
    const sanitizedLanguage = sanitizeLanguageCode(language);
    const effectiveLanguage = sanitizedLanguage === "auto" ? "" : sanitizedLanguage;
    const allVariables: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(selectedProvider.variables).map(([key, value]) => [
          key.toUpperCase(),
          value,
        ])
      ),
      // Add language to variables for template replacement (empty string for auto-detect)
      LANGUAGE: effectiveLanguage,
    };

    // Prepare request
    let url = deepVariableReplacer(curlJson.url || "", allVariables);
    const headers = deepVariableReplacer(curlJson.header || {}, allVariables);
    const formData = deepVariableReplacer(curlJson.form || {}, allVariables);

    // To Check if API accepts Binary Data
    const isBinaryUpload = provider.curl.includes("--data-binary");
    // Fetch URL Params
    const rawParams = curlJson.params || {};
    // Decode Them
    const decodedParams = Object.fromEntries(
      Object.entries(rawParams).map(([key, value]) => [
        key,
        typeof value === "string" ? decodeURIComponent(value) : "",
      ])
    );
    // Get the Parameters from allVariables
    const replacedParams = deepVariableReplacer(decodedParams, allVariables);

    // Add query parameters to URL
    const queryString = new URLSearchParams(replacedParams).toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }

    let finalHeaders = { ...headers };
    let body: FormData | string | Blob;

    const isForm =
      provider.curl.includes("-F ") || provider.curl.includes("--form");
    if (isForm) {
      const form = new FormData();
      const freshBlob = new Blob([await audio.arrayBuffer()], {
        type: audio.type,
      });
      form.append("file", freshBlob, "audio.wav");
      const headerKeys = Object.keys(headers).map((k) =>
        k.toUpperCase().replace(/[-_]/g, "")
      );

      for (const [key, val] of Object.entries(formData)) {
        if (typeof val !== "string") {
          if (
            !val ||
            headerKeys.includes(key.toUpperCase()) ||
            key.toUpperCase() === "AUDIO"
          )
            continue;
          form.append(key.toLowerCase(), val as string | Blob);
          continue;
        }

        // Check if key is a number, which indicates array-like parsing from curl2json
        if (!isNaN(parseInt(key, 10))) {
          const [formKey, ...formValueParts] = val.split("=");
          const formValue = formValueParts.join("=");

          if (formKey.toLowerCase() === "file") continue; // Already handled by form.append('file', audio)

          if (
            !formValue ||
            headerKeys.includes(formKey.toUpperCase().replace(/[-_]/g, ""))
          )
            continue;

          form.append(formKey, formValue);
        } else {
          if (key.toLowerCase() === "file") continue; // Already handled by form.append('file', audio)
          if (
            !val ||
            headerKeys.includes(key.toUpperCase()) ||
            key.toUpperCase() === "AUDIO"
          )
            continue;
          form.append(key.toLowerCase(), val as string | Blob);
        }
      }
      delete finalHeaders["Content-Type"];
      body = form;
    } else if (isBinaryUpload) {
      // Deepgram-style: raw binary body
      body = new Blob([await audio.arrayBuffer()], {
        type: audio.type,
      });
    } else {
      // Google-style: JSON payload with base64
      allVariables.AUDIO = await blobToBase64(audio);
      const dataObj = curlJson.data ? { ...curlJson.data } : {};
      body = JSON.stringify(deepVariableReplacer(dataObj, allVariables));
    }

    // Use tauriFetch for external HTTP URLs to avoid CORS issues
    const fetchFunction = url?.includes("http") ? tauriFetch : fetch;

    // Send request
    let response: Response;
    try {
      response = await fetchFunction(url, {
        method: curlJson.method || "POST",
        headers: finalHeaders,
        body: curlJson.method === "GET" ? undefined : body,
      });
    } catch (e) {
      throw new Error(`Network error: ${e instanceof Error ? e.message : e}`);
    }

    if (!response.ok) {
      let errText = "";
      try {
        errText = await response.text();
      } catch {}
      let errMsg: string;
      try {
        const errObj = JSON.parse(errText);
        errMsg = errObj.message || errText;
      } catch {
        errMsg = errText || response.statusText;
      }
      throw new Error(`HTTP ${response.status}: ${errMsg}`);
    }

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return [...warnings, responseText.trim()].filter(Boolean).join("; ");
    }

    // Extract transcription
    const rawPath = provider.responseContentPath || "text";
    const path = rawPath.charAt(0).toLowerCase() + rawPath.slice(1);
    const transcription = (getByPath(data, path) || "").trim();

    if (!transcription) {
      return [...warnings, "No transcription found"].join("; ");
    }

    // Emit STT usage for cost tracking
    try {
      const audioSeconds = await estimateAudioDuration(audio);
      const providerId = selectedProvider.provider || "openai";
      const modelName = provider.id || "whisper-1";
      emitSTTUsage(providerId, modelName, audioSeconds);
    } catch (usageError) {
      console.warn("Failed to emit STT usage:", usageError);
    }

    // Return transcription with any warnings
    return [...warnings, transcription].filter(Boolean).join("; ");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Provide helpful error recovery guidance
    const { provider, language } = params;
    const isAutoDetect = language === "auto" || language === "" || language === undefined;

    // If error occurred with auto-detect on a provider that may not support it
    if (isAutoDetect && provider?.supportsAutoDetect === false) {
      const enhancedMsg = `${msg}. Tip: Your provider may not support auto-detect. ` +
        `Try selecting a specific language in Settings > Language.`;
      throw new Error(enhancedMsg);
    }

    // General error with auto-detect - suggest trying specific language
    if (isAutoDetect) {
      const enhancedMsg = `${msg}. If this persists, try selecting a specific language ` +
        `instead of auto-detect in Settings > Language.`;
      throw new Error(enhancedMsg);
    }

    throw new Error(msg);
  }
}

/**
 * Result of STT with diarization support.
 */
export interface STTDiarizationResult {
  /** Combined transcription text */
  transcription: string;
  /** Individual transcript entries with speaker info */
  entries: TranscriptEntry[];
  /** Whether diarization was available */
  hasDiarization: boolean;
}

/**
 * Extended parameters for STT with speaker diarization support.
 * Inherits language handling from STTParams:
 * - "auto" triggers auto-detection (AssemblyAI omits language_code)
 * - undefined defaults to auto-detect for AssemblyAI
 * - Specific language codes are passed directly to the provider
 */
export interface STTDiarizationParams extends STTParams {
  /** Enable speaker diarization (only works with compatible providers like AssemblyAI) */
  enableDiarization?: boolean;
}

/**
 * Transcribes audio with optional speaker diarization.
 * Returns structured entries with speaker information when using a diarization-enabled provider.
 *
 * @param params - The STT parameters including provider, audio, language, and diarization settings
 * @returns Object containing transcription text, individual entries with speaker info, and diarization status
 *
 * @example
 * // With auto-detect language and diarization
 * const result = await fetchSTTWithDiarization({
 *   provider, selectedProvider, audio,
 *   language: "auto",
 *   enableDiarization: true
 * });
 */
export async function fetchSTTWithDiarization(
  params: STTDiarizationParams
): Promise<STTDiarizationResult> {
  const { provider, selectedProvider, audio, language, enableDiarization = true } = params;

  // Validate language compatibility with provider
  const isAutoDetect = language === "auto" || language === "" || language === undefined;
  if (isAutoDetect && provider?.supportsAutoDetect === false) {
    const providerName = provider.name || provider.id || "This provider";
    console.warn(
      `[STT Diarization] Warning: ${providerName} may not support auto-detect language. ` +
      `Consider selecting a specific language for better accuracy.`
    );
  }

  // Check if provider supports diarization
  const isDiarizationProvider =
    provider?.requiresSpecialHandler &&
    provider?.specialHandler === "assemblyai-diarization";

  if (isDiarizationProvider && enableDiarization) {
    // Use AssemblyAI with diarization
    // Check for API key in both cases (api_key and API_KEY)
    const apiKey = selectedProvider.variables?.API_KEY || selectedProvider.variables?.api_key;
    if (!apiKey) {
      throw new Error("AssemblyAI API key is required for speaker diarization");
    }

    try {
      // AssemblyAI uses undefined for auto-detection (omits language_code from request body)
      // This differs from template-based providers which use empty string in URL/form params
      // SECURITY: Sanitize language code before passing to API
      const sanitizedLang = sanitizeLanguageCode(language);
      const effectiveLang = (!sanitizedLang || sanitizedLang === "auto") ? undefined : sanitizedLang;
      const result = await fetchAssemblyAIWithDiarization(audio, {
        apiKey,
        language: effectiveLang,
      });

      // Convert utterances to TranscriptEntry format
      const entries: TranscriptEntry[] = result.utterances.map(
        (utterance: AssemblyAIUtterance, index: number) => ({
          original: utterance.text,
          timestamp: Date.now() - (result.utterances.length - index) * 1000, // Approximate timestamps
          speaker: {
            speakerId: utterance.speaker,
            confidence: utterance.confidence,
          } as SpeakerInfo,
        })
      );

      // If no utterances but we have transcription, create a single entry
      if (entries.length === 0 && result.transcription) {
        entries.push({
          original: result.transcription,
          timestamp: Date.now(),
        });
      }

      return {
        transcription: result.transcription,
        entries,
        hasDiarization: entries.some((e) => e.speaker !== undefined),
      };
    } catch (error) {
      console.error("[STT Diarization] AssemblyAI error:", error);

      // Provide helpful error recovery guidance for auto-detect failures
      const isAutoDetect = language === "auto" || language === "" || language === undefined;
      if (isAutoDetect) {
        const msg = error instanceof Error ? error.message : String(error);
        const enhancedMsg = `${msg}. If this persists with auto-detect, try selecting ` +
          `a specific language in Settings > Language.`;
        throw new Error(enhancedMsg);
      }

      throw error;
    }
  }

  // Fall back to standard STT (no diarization)
  const transcription = await fetchSTT(params);

  return {
    transcription,
    entries: [
      {
        original: transcription,
        timestamp: Date.now(),
      },
    ],
    hasDiarization: false,
  };
}

/**
 * Checks if a provider supports speaker diarization.
 */
export function providerSupportsDiarization(provider: TYPE_PROVIDER | undefined): boolean {
  return (
    provider?.requiresSpecialHandler === true &&
    provider?.specialHandler === "assemblyai-diarization"
  );
}

/**
 * Checks if a provider supports automatic language detection.
 * Returns true if provider explicitly supports auto-detect, false otherwise.
 *
 * Note: Custom providers (isCustom=true) return true by default since
 * we can't validate their capabilities.
 *
 * @param provider - The STT provider to check
 * @returns true if provider supports auto-detect, false otherwise
 */
export function providerSupportsAutoDetect(provider: TYPE_PROVIDER | undefined): boolean {
  if (!provider) return false;

  // Custom providers: assume they support auto-detect (user configured them)
  if (provider.isCustom) return true;

  // Check the supportsAutoDetect flag
  return provider.supportsAutoDetect === true;
}

/**
 * Validates that the selected language is compatible with the provider.
 * Returns a warning message if there's a potential compatibility issue.
 *
 * @param provider - The STT provider
 * @param language - The selected language code ("auto", specific code, or undefined)
 * @returns Warning message if incompatible, undefined if compatible
 */
export function validateLanguageProviderCompatibility(
  provider: TYPE_PROVIDER | undefined,
  language: string | undefined
): string | undefined {
  if (!provider) return undefined;

  const isAutoDetect = language === "auto" || language === "" || language === undefined;

  if (isAutoDetect && !providerSupportsAutoDetect(provider)) {
    const providerName = provider.name || provider.id || "This provider";
    return `${providerName} may not support auto-detect. ` +
      `Consider selecting a specific language for better accuracy. ` +
      `Providers like Google STT and Azure require a language code.`;
  }

  return undefined;
}
