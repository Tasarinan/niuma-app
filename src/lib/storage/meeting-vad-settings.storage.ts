import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "./helper";

/**
 * User-adjustable sensitivity settings for the Meeting Channel's system-audio
 * voice-activity detection (Rust-side capture). Previously these were only
 * exposed via the orphaned speech/VadConfigPanel.tsx (never reachable in the
 * live app) and the actual capture pipeline (useMeetingAudio.ts) used a
 * hardcoded config. This centralizes the setting on the /audio settings page.
 */
export interface MeetingVadSettings {
  /** Lower = more sensitive (picks up quieter sounds). */
  sensitivityRms: number;
  /** Number of silent chunks to wait before ending a speech segment. */
  silenceChunks: number;
}

export const DEFAULT_MEETING_VAD_SETTINGS: MeetingVadSettings = {
  sensitivityRms: 0.012,
  silenceChunks: 45,
};

export const getMeetingVadSettings = (): MeetingVadSettings => {
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEYS.MEETING_VAD_SETTINGS);
    if (!stored) {
      return DEFAULT_MEETING_VAD_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    return {
      sensitivityRms:
        typeof parsed.sensitivityRms === "number"
          ? parsed.sensitivityRms
          : DEFAULT_MEETING_VAD_SETTINGS.sensitivityRms,
      silenceChunks:
        typeof parsed.silenceChunks === "number"
          ? parsed.silenceChunks
          : DEFAULT_MEETING_VAD_SETTINGS.silenceChunks,
    };
  } catch (error) {
    console.error("Failed to get meeting VAD settings:", error);
    return DEFAULT_MEETING_VAD_SETTINGS;
  }
};

export const setMeetingVadSettings = (settings: MeetingVadSettings): void => {
  try {
    safeLocalStorage.setItem(STORAGE_KEYS.MEETING_VAD_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save meeting VAD settings:", error);
  }
};
