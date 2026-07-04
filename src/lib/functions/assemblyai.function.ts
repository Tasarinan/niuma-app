import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * AssemblyAI Transcript Result with speaker diarization.
 */
export interface AssemblyAIUtterance {
  speaker: string; // "A", "B", "C", etc.
  text: string;
  start: number; // milliseconds
  end: number; // milliseconds
  confidence: number;
}

export interface AssemblyAITranscriptResult {
  transcription: string;
  utterances: AssemblyAIUtterance[];
  rawResponse: any;
  audioDurationSeconds?: number;
}

export interface AssemblyAIConfig {
  apiKey: string;
  language?: string;
  speakersExpected?: number;
}

const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";

/**
 * Uploads audio to AssemblyAI and returns the upload URL.
 */
async function uploadAudio(audio: Blob, apiKey: string): Promise<string> {
  const response = await tauriFetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: audio,
  });

  if (!response.ok) {
    // Security: Never expose full error response (may contain API key)
    // Only expose HTTP status for debugging
    throw new Error(`AssemblyAI upload failed: ${response.status}`);
  }

  const data = await response.json();
  return data.upload_url;
}

/**
 * Creates a transcription job with speaker diarization enabled.
 */
async function createTranscript(
  audioUrl: string,
  apiKey: string,
  language?: string,
  speakersExpected?: number
): Promise<string> {
  const body: Record<string, any> = {
    audio_url: audioUrl,
    speaker_labels: true,
  };

  // Handle language parameter:
  // - "auto" or empty: use AssemblyAI's automatic language detection
  // - specific code (en, es, fr, etc.): use that language
  if (language && language !== "auto") {
    body.language_code = language;
  } else {
    // Enable automatic language detection when "auto" or not specified
    body.language_detection = true;
  }

  if (speakersExpected && speakersExpected > 0) {
    body.speakers_expected = speakersExpected;
  }

  const response = await tauriFetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Security: Never expose full error response (may contain API key)
    // Only expose HTTP status for debugging
    throw new Error(`AssemblyAI transcript creation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Polls for transcript completion.
 */
async function pollForCompletion(
  transcriptId: string,
  apiKey: string,
  maxAttempts: number = 60,
  intervalMs: number = 1000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await tauriFetch(
      `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
      {
        headers: { Authorization: apiKey },
      }
    );

    if (!response.ok) {
      // Security: Never expose full error response (may contain API key)
      // Only expose HTTP status for debugging
      throw new Error(`AssemblyAI polling failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.status === "completed") {
      return result;
    }

    if (result.status === "error") {
      // Note: result.error is from transcript result, not HTTP auth error, safe to expose
      throw new Error(`AssemblyAI transcription failed: ${result.error}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("AssemblyAI transcription timeout - exceeded maximum polling attempts");
}

/**
 * Estimates audio duration from a Blob.
 */
async function estimateAudioDuration(audio: Blob): Promise<number> {
  try {
    if (audio.type === "audio/wav" || audio.type === "audio/wave") {
      const buffer = await audio.arrayBuffer();
      const view = new DataView(buffer);
      // WAV header: bytes 28-31 contain byte rate
      const byteRate = view.getInt32(28, true);
      if (byteRate > 0) {
        const dataSize = buffer.byteLength - 44;
        return dataSize / byteRate;
      }
    }
    // Fallback: estimate based on file size
    const bytesPerSecond = 16000 / 8; // 16kbps = 2000 bytes/sec
    return audio.size / bytesPerSecond;
  } catch {
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
  console.log("[AssemblyAI] Emitting stt-usage-captured event:", { provider, model, audioSeconds });
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

/**
 * Transcribes audio using AssemblyAI with speaker diarization.
 *
 * Process:
 * 1. Upload audio file to AssemblyAI
 * 2. Create transcript job with speaker_labels enabled
 * 3. Poll until transcription is complete
 * 4. Return structured result with utterances
 */
export async function fetchAssemblyAIWithDiarization(
  audio: Blob,
  config: AssemblyAIConfig
): Promise<AssemblyAITranscriptResult> {
  const { apiKey, language, speakersExpected } = config;

  if (!apiKey) {
    throw new Error("AssemblyAI API key is required");
  }

  // Step 1: Upload audio
  console.log("[AssemblyAI] Uploading audio...");
  const uploadUrl = await uploadAudio(audio, apiKey);
  console.log("[AssemblyAI] Audio uploaded successfully");

  // Step 2: Create transcript with diarization
  console.log("[AssemblyAI] Creating transcript with speaker diarization...");
  const transcriptId = await createTranscript(
    uploadUrl,
    apiKey,
    language,
    speakersExpected
  );
  console.log("[AssemblyAI] Transcript job created:", transcriptId);

  // Step 3: Poll for completion
  console.log("[AssemblyAI] Polling for completion...");
  const result = await pollForCompletion(transcriptId, apiKey);
  console.log("[AssemblyAI] Transcription completed");

  // Estimate audio duration for cost tracking
  const audioDurationSeconds = await estimateAudioDuration(audio);

  // Emit usage for cost tracking
  emitSTTUsage("assemblyai", "universal-diarization", audioDurationSeconds);

  // Format utterances
  const utterances: AssemblyAIUtterance[] = (result.utterances || []).map(
    (u: any) => ({
      speaker: u.speaker,
      text: u.text,
      start: u.start,
      end: u.end,
      confidence: u.confidence,
    })
  );

  console.log("[AssemblyAI] Raw utterances from API:", {
    utteranceCount: utterances.length,
    utterances: utterances.map((u) => ({
      speaker: u.speaker,
      text: u.text.substring(0, 50) + (u.text.length > 50 ? "..." : ""),
      confidence: u.confidence,
    })),
    fullText: result.text?.substring(0, 100),
  });

  return {
    transcription: result.text || "",
    utterances,
    rawResponse: result,
    audioDurationSeconds,
  };
}

/**
 * Simple transcription without diarization result parsing.
 * Returns just the text for compatibility with existing STT flow.
 */
export async function fetchAssemblyAISimple(
  audio: Blob,
  config: AssemblyAIConfig
): Promise<string> {
  const result = await fetchAssemblyAIWithDiarization(audio, config);
  return result.transcription;
}
