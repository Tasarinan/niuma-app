import { fetchAIResponse } from "./ai-response.function";
import { shouldUseNiumaAPI } from "./Niuma.api";
import type { TYPE_PROVIDER, VideoKeyPoint, VideoTranscriptSegment } from "@/types";

export type VideoKeyPointProviderConfig = {
  provider: TYPE_PROVIDER | undefined;
  selectedProvider: {
    provider: string;
    variables: Record<string, string>;
  };
};

// Minimum number of transcript segments required before extraction is worthwhile.
const MIN_SEGMENTS_FOR_EXTRACTION = 2;

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats a timestamped transcript for the AI prompt, e.g.
 * "[00:12 - 00:45] Hello everyone, today we'll cover..."
 */
function formatTranscriptForExtraction(segments: VideoTranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatTimestamp(s.start)} - ${formatTimestamp(s.end)}] ${s.text}`)
    .join("\n");
}

const KEY_POINT_EXTRACTION_PROMPT = `You are a video content analyst. Given a timestamped transcript of a video, identify the most important key points/moments.

Respond ONLY with a valid JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{
  "keyPoints": [
    {"start": 12, "end": 45, "title": "Short title", "summary": "1-2 sentence summary of this moment"}
  ]
}

Rules:
- "start" and "end" are timestamps in whole seconds, taken from the transcript's own [mm:ss] markers
- Identify 3-8 key points depending on video length and content density
- Each key point should cover a distinct, meaningful moment (a new topic, decision, demo, or important statement)
- "title": short, descriptive (4-8 words)
- "summary": concise, 1-2 sentences
- Order key points chronologically
- Do NOT invent timestamps outside the transcript's range`;

/**
 * Parses the AI response into a validated VideoKeyPoint[].
 */
function parseKeyPointResponse(response: string): VideoKeyPoint[] | null {
  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.keyPoints)) {
      return null;
    }

    return parsed.keyPoints
      .filter(
        (kp: any) =>
          kp &&
          typeof kp.title === "string" &&
          typeof kp.summary === "string" &&
          typeof kp.start === "number" &&
          typeof kp.end === "number"
      )
      .map(
        (kp: any, index: number): VideoKeyPoint => ({
          id: `keypoint_${index}_${Math.round(kp.start)}`,
          start: Math.max(0, kp.start),
          end: Math.max(kp.start, kp.end),
          title: kp.title,
          summary: kp.summary,
        })
      );
  } catch (error) {
    console.error("Failed to parse video key point response:", error);
    console.error("Raw response:", response);
    return null;
  }
}

/**
 * Checks if a transcript has enough content to be worth extracting key points from.
 */
export function shouldExtractKeyPoints(segments: VideoTranscriptSegment[]): boolean {
  return segments.filter((s) => s.text.trim()).length >= MIN_SEGMENTS_FOR_EXTRACTION;
}

/**
 * Extracts key points from a transcribed video using AI, mirroring the
 * meeting-summarizer.ts pattern (fetchAIResponse + JSON-schema prompt).
 */
export async function extractVideoKeyPoints(
  segments: VideoTranscriptSegment[],
  providerConfig?: VideoKeyPointProviderConfig
): Promise<VideoKeyPoint[] | null> {
  if (!shouldExtractKeyPoints(segments)) {
    console.log(`Skipping key point extraction: only ${segments.length} transcript segment(s)`);
    return null;
  }

  const transcriptText = formatTranscriptForExtraction(segments);
  const userMessage = `VIDEO TRANSCRIPT:\n${transcriptText}\n\nProvide the JSON key points:`;

  try {
    const useNiumaAPI = await shouldUseNiumaAPI();
    if (!useNiumaAPI && !providerConfig) {
      console.log("No AI provider configured for video key point extraction");
      return null;
    }

    let fullResponse = "";
    for await (const chunk of fetchAIResponse({
      provider: useNiumaAPI ? undefined : providerConfig?.provider,
      selectedProvider: providerConfig?.selectedProvider || { provider: "", variables: {} },
      systemPrompt: KEY_POINT_EXTRACTION_PROMPT,
      history: [],
      userMessage,
      imagesBase64: [],
    })) {
      fullResponse += chunk;
    }

    return parseKeyPointResponse(fullResponse);
  } catch (error) {
    console.error("Error extracting video key points:", error);
    return null;
  }
}
