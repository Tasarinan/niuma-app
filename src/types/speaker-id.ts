/**
 * Speaker ID Type System
 *
 * Provides type-safe speaker identification with clear origin prefixes.
 * This prevents confusion between different ID sources and makes debugging easier.
 */

/**
 * Speaker ID discriminated union with prefixes for clarity.
 *
 * Format examples:
 * - `diarization_A` - AssemblyAI diarization labels (A, B, C, etc.)
 * - `source_you` - User's microphone input
 * - `source_guest_1234567890` - System audio before diarization (with timestamp)
 * - `profile_uuid-here` - Matched speaker profile ID
 */
export type SpeakerId =
  | `diarization_${string}` // AssemblyAI labels: "diarization_A", "diarization_B"
  | `source_${string}` // Audio source: "source_you", "source_guest_1234567890"
  | `profile_${string}`; // Profile IDs: "profile_uuid"

/**
 * Helper functions for creating type-safe speaker IDs
 */
export const SpeakerIdFactory = {
  /**
   * Create ID for AssemblyAI diarization label
   * @param label - "A", "B", "C", etc.
   */
  diarization: (label: string): SpeakerId => `diarization_${label}`,

  /**
   * Create ID for user's microphone input
   */
  you: (): SpeakerId => "source_you",

  /**
   * Create ID for system audio (guest) before diarization
   * @param timestamp - Timestamp for unique identification
   */
  guest: (timestamp: number): SpeakerId => `source_guest_${timestamp}`,

  /**
   * Create ID from speaker profile
   * @param profileId - UUID of the speaker profile
   */
  profile: (profileId: string): SpeakerId => `profile_${profileId}`,
};

/**
 * Helper functions for parsing speaker IDs
 */
export const SpeakerIdParser = {
  /**
   * Get the type of speaker ID
   */
  getType: (
    speakerId: SpeakerId
  ): "diarization" | "source" | "profile" | "unknown" => {
    if (speakerId.startsWith("diarization_")) return "diarization";
    if (speakerId.startsWith("source_")) return "source";
    if (speakerId.startsWith("profile_")) return "profile";
    return "unknown";
  },

  /**
   * Extract diarization label from ID
   * @returns "A", "B", "C", etc., or null if not a diarization ID
   */
  getDiarizationLabel: (speakerId: SpeakerId): string | null => {
    if (speakerId.startsWith("diarization_")) {
      return speakerId.replace("diarization_", "");
    }
    return null;
  },

  /**
   * Extract profile ID from speaker ID
   * @returns Profile UUID or null if not a profile ID
   */
  getProfileId: (speakerId: SpeakerId): string | null => {
    if (speakerId.startsWith("profile_")) {
      return speakerId.replace("profile_", "");
    }
    return null;
  },

  /**
   * Check if ID represents the user
   */
  isYou: (speakerId: SpeakerId): boolean => {
    return speakerId === "source_you";
  },

  /**
   * Check if ID represents a guest (before diarization)
   */
  isGuest: (speakerId: SpeakerId): boolean => {
    return speakerId.startsWith("source_guest_");
  },

  /**
   * Extract timestamp from guest speaker ID
   * @returns Timestamp or null if not a guest ID
   */
  getGuestTimestamp: (speakerId: SpeakerId): number | null => {
    if (speakerId.startsWith("source_guest_")) {
      const timestamp = speakerId.replace("source_guest_", "");
      const parsed = parseInt(timestamp, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  },
};

/**
 * Migration helper: Convert old speaker IDs to new format
 *
 * Maps legacy IDs to the new prefixed format:
 * - "user" -> "source_you"
 * - "guest_123" -> "source_guest_123"
 * - "A", "B", "C" -> "diarization_A", etc.
 * - Profile UUIDs -> "profile_uuid"
 */
export function migrateSpeakerId(oldId: string): SpeakerId {
  // Already in new format
  if (
    oldId.startsWith("diarization_") ||
    oldId.startsWith("source_") ||
    oldId.startsWith("profile_")
  ) {
    return oldId as SpeakerId;
  }

  // Legacy format conversions
  if (oldId === "user") {
    return SpeakerIdFactory.you();
  }

  if (oldId.startsWith("guest_")) {
    const timestamp = oldId.replace("guest_", "");
    return `source_guest_${timestamp}`;
  }

  // Single letter = diarization label
  if (oldId.length === 1 && /^[A-Z]$/.test(oldId)) {
    return SpeakerIdFactory.diarization(oldId);
  }

  // Assume it's a profile ID (UUID or similar)
  return SpeakerIdFactory.profile(oldId);
}
