// Types for the Video Insights feature (Phase 3): transcribing a locally
// selected video and extracting AI-identified key points with timestamps.

export interface VideoTranscriptSegment {
  /** Start time of this segment, in seconds from the video's start. */
  start: number;
  /** End time of this segment, in seconds from the video's start. */
  end: number;
  text: string;
}

export interface VideoKeyPoint {
  id: string;
  /** Start time of the key moment, in seconds from the video's start. */
  start: number;
  /** End time of the key moment, in seconds from the video's start. */
  end: number;
  title: string;
  summary: string;
}

export type VideoInsightsStage =
  | "idle"
  | "transcribing"
  | "extracting"
  | "done"
  | "error";
