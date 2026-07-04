import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
  PitchProfile,
  PitchAnalysisResult,
  comparePitchProfiles,
  mergePitchProfiles,
  createPitchProfile,
} from "@/lib/functions/pitch-analysis";

/**
 * Speaker profile for identification in meeting transcripts.
 *
 * Enhanced with pitch-based automatic recognition.
 * Profiles are now used for:
 * - Manual speaker tagging via SpeakerTaggingPopover
 * - Automatic pitch-based speaker recognition
 * - Color-coded visual distinction in transcripts
 * - Learning over time with pitch profile updates
 */
export interface SpeakerProfile {
  id: string; // UUID
  name: string; // "You", "Sarah Chen", "Speaker 3 (Unnamed)", etc.
  type: "user" | "colleague" | "client" | "other";
  color: string; // Hex color for visual distinction
  createdAt: number; // Timestamp
  lastSeenAt: number; // Last time this speaker was detected/tagged

  // Pitch-based identification
  pitchProfile?: PitchProfile; // Voice characteristics for automatic matching
  isConfirmed: boolean; // true = user-named, false = auto-created
  autoCreatedFrom?: string; // Original session/batch ID when auto-created
  sampleTranscript?: string; // Sample text from this speaker (for naming context)
}

interface SpeakerProfilesDB extends DBSchema {
  profiles: {
    key: string;
    value: SpeakerProfile;
    indexes: { "by-type": string };
  };
}

let db: IDBPDatabase<SpeakerProfilesDB> | null = null;

/**
 * Gets or creates the IndexedDB database.
 */
async function getDB(): Promise<IDBPDatabase<SpeakerProfilesDB>> {
  if (!db) {
    db = await openDB<SpeakerProfilesDB>("speaker-profiles", 3, {
      upgrade(db, oldVersion) {
        // Version 1 -> 2: Remove audioSamples store (no longer needed)
        if (oldVersion < 2) {
          // Delete old audioSamples store if it exists
          // Using type assertion because the old schema included audioSamples
          const storeNames = db.objectStoreNames as DOMStringList;
          if (storeNames.contains("audioSamples")) {
            (db as unknown as IDBDatabase).deleteObjectStore("audioSamples");
          }
        }

        // Create profiles store if it doesn't exist
        if (!db.objectStoreNames.contains("profiles")) {
          const profileStore = db.createObjectStore("profiles", { keyPath: "id" });
          profileStore.createIndex("by-type", "type");
        }

        // Version 2 -> 3: Add pitch-based recognition fields
        // Existing profiles will have isConfirmed = true (user-created)
        // Migration happens automatically - new fields are optional
      },
    });
  }
  return db;
}

/**
 * Gets all speaker profiles.
 */
export async function getSpeakerProfiles(): Promise<SpeakerProfile[]> {
  const database = await getDB();
  return database.getAll("profiles");
}

/**
 * Gets a specific speaker profile by ID.
 */
export async function getSpeakerProfile(
  id: string
): Promise<SpeakerProfile | undefined> {
  const database = await getDB();
  return database.get("profiles", id);
}

/**
 * Gets the user's own profile (type = 'user').
 */
export async function getUserProfile(): Promise<SpeakerProfile | undefined> {
  const database = await getDB();
  const profiles = await database.getAllFromIndex("profiles", "by-type", "user");
  return profiles[0]; // Should only be one user profile
}

/**
 * Gets all profiles except the user's own.
 */
export async function getOtherProfiles(): Promise<SpeakerProfile[]> {
  const database = await getDB();
  const allProfiles = await database.getAll("profiles");
  return allProfiles.filter((p) => p.type !== "user");
}

/**
 * Saves a speaker profile.
 */
export async function saveSpeakerProfile(profile: SpeakerProfile): Promise<void> {
  const database = await getDB();
  await database.put("profiles", profile);
}

/**
 * Deletes a speaker profile.
 */
export async function deleteSpeakerProfile(id: string): Promise<void> {
  const database = await getDB();
  await database.delete("profiles", id);
}

/**
 * Creates a new speaker profile with default values.
 */
export function createSpeakerProfile(
  name: string,
  type: SpeakerProfile["type"],
  color?: string
): SpeakerProfile {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    color: color || getRandomColor(),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    isConfirmed: true, // Manually created profiles are confirmed
  };
}

/**
 * Gets a random color for a speaker profile.
 */
function getRandomColor(): string {
  const colors = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#a855f7", // purple
    "#f97316", // orange
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#eab308", // yellow
    "#ef4444", // red
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Deletes all speaker profiles.
 */
export async function deleteAllSpeakerData(): Promise<void> {
  const database = await getDB();
  await database.clear("profiles");
}

// ============================================================================
// PITCH-BASED SPEAKER RECOGNITION FUNCTIONS
// ============================================================================

/**
 * Find a speaker profile by pitch similarity.
 * Returns the best match if similarity is above the threshold.
 *
 * @param pitchResult - Pitch analysis result to match
 * @param threshold - Minimum similarity percentage (0-100), default 80
 * @returns Matching profile or null if no match above threshold
 */
export async function findProfileByPitch(
  pitchResult: PitchAnalysisResult,
  threshold: number = 80
): Promise<SpeakerProfile | null> {
  const allProfiles = await getSpeakerProfiles();

  // Only consider profiles with pitch data
  const profilesWithPitch = allProfiles.filter((p) => p.pitchProfile);

  if (profilesWithPitch.length === 0) {
    return null;
  }

  // Calculate similarity for each profile
  const matches = profilesWithPitch.map((profile) => {
    const similarity = comparePitchProfiles(profile.pitchProfile!, pitchResult);
    return { profile, similarity };
  });

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  const bestMatch = matches[0];

  // Check if best match is above threshold
  if (bestMatch && bestMatch.similarity >= threshold) {
    // Check for ambiguous matches (multiple profiles very close in similarity)
    const secondBest = matches[1];
    if (secondBest && Math.abs(bestMatch.similarity - secondBest.similarity) < 10) {
      // Ambiguous - two profiles match almost equally well
      // Return null to create new profile instead of guessing
      console.log(
        `[SpeakerProfiles] Ambiguous match: ${bestMatch.profile.name} (${bestMatch.similarity.toFixed(1)}%) vs ${secondBest.profile.name} (${secondBest.similarity.toFixed(1)}%)`
      );
      return null;
    }

    console.log(
      `[SpeakerProfiles] Matched to ${bestMatch.profile.name} (${bestMatch.similarity.toFixed(1)}% confidence)`
    );
    return bestMatch.profile;
  }

  return null;
}

/**
 * Update a profile's pitch data with new analysis (learning over time).
 *
 * @param profileId - Profile to update
 * @param newPitchData - New pitch analysis result
 */
export async function updateProfilePitch(
  profileId: string,
  newPitchData: PitchAnalysisResult
): Promise<void> {
  const profile = await getSpeakerProfile(profileId);
  if (!profile) {
    console.warn(`[SpeakerProfiles] Profile ${profileId} not found for pitch update`);
    return;
  }

  // Merge new data with existing profile
  if (profile.pitchProfile) {
    profile.pitchProfile = mergePitchProfiles(profile.pitchProfile, newPitchData);
  } else {
    profile.pitchProfile = createPitchProfile(newPitchData);
  }

  profile.lastSeenAt = Date.now();
  await saveSpeakerProfile(profile);

  console.log(
    `[SpeakerProfiles] Updated pitch profile for ${profile.name} (${profile.pitchProfile.sampleCount} samples)`
  );
}

/**
 * Create an auto-detected profile from pitch analysis.
 * These profiles are unconfirmed until user assigns a name.
 *
 * @param pitchData - Pitch analysis result
 * @param sessionId - Original session/batch ID for tracking
 * @param sampleText - Sample transcript text for context
 * @returns Newly created profile
 */
export async function createAutoProfile(
  pitchData: PitchAnalysisResult,
  sessionId: string,
  sampleText?: string
): Promise<SpeakerProfile> {
  // Find next speaker number for naming
  const allProfiles = await getSpeakerProfiles();
  const unconfirmedProfiles = allProfiles.filter((p) => !p.isConfirmed);

  let speakerNumber = 1;
  const existingNumbers = unconfirmedProfiles
    .map((p) => {
      const match = p.name.match(/Speaker (\d+)/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter((n) => n > 0);

  if (existingNumbers.length > 0) {
    speakerNumber = Math.max(...existingNumbers) + 1;
  }

  const profile: SpeakerProfile = {
    id: crypto.randomUUID(),
    name: `Speaker ${speakerNumber} (Unnamed)`,
    type: "other",
    color: getRandomColor(),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    isConfirmed: false,
    autoCreatedFrom: sessionId,
    pitchProfile: createPitchProfile(pitchData),
    sampleTranscript: sampleText?.slice(0, 100), // Store first 100 chars for context
  };

  await saveSpeakerProfile(profile);

  console.log(
    `[SpeakerProfiles] Created auto-profile: ${profile.name} (pitch: ${pitchData.avgHz.toFixed(0)} Hz)`
  );

  return profile;
}

/**
 * Get all unconfirmed profiles (auto-created, awaiting user naming).
 */
export async function getUnconfirmedProfiles(): Promise<SpeakerProfile[]> {
  const allProfiles = await getSpeakerProfiles();
  return allProfiles
    .filter((p) => !p.isConfirmed)
    .sort((a, b) => b.createdAt - a.createdAt); // Most recent first
}

/**
 * Confirm a profile by assigning it a user-provided name.
 * Converts an auto-created profile into a confirmed one.
 *
 * @param profileId - Profile to confirm
 * @param name - User-provided name
 * @param type - Profile type
 */
export async function confirmProfile(
  profileId: string,
  name: string,
  type: "colleague" | "client" | "other"
): Promise<void> {
  const profile = await getSpeakerProfile(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  profile.name = name;
  profile.type = type;
  profile.isConfirmed = true;
  profile.lastSeenAt = Date.now();
  // Keep pitchProfile for future matching

  await saveSpeakerProfile(profile);

  console.log(`[SpeakerProfiles] Confirmed profile: ${name}`);
}

/**
 * Bulk confirm multiple profiles at once.
 * Used when naming multiple speakers after a meeting.
 *
 * @param confirmations - Array of { profileId, name, type }
 */
export async function confirmProfiles(
  confirmations: Array<{
    profileId: string;
    name: string;
    type: "colleague" | "client" | "other";
  }>
): Promise<void> {
  for (const confirmation of confirmations) {
    await confirmProfile(confirmation.profileId, confirmation.name, confirmation.type);
  }
}

/**
 * Migrate existing profiles to add isConfirmed field.
 * Called on app startup to ensure backward compatibility.
 */
export async function migrateExistingProfiles(): Promise<void> {
  const allProfiles = await getSpeakerProfiles();
  let migrated = 0;

  for (const profile of allProfiles) {
    if (!profile.hasOwnProperty("isConfirmed")) {
      profile.isConfirmed = true; // Existing profiles are user-created
      await saveSpeakerProfile(profile);
      migrated++;
    }
  }

  if (migrated > 0) {
    console.log(`[SpeakerProfiles] Migrated ${migrated} existing profiles`);
  }
}

/**
 * Export all profiles as JSON for backup/sync.
 */
export async function exportProfiles(): Promise<string> {
  const profiles = await getSpeakerProfiles();
  return JSON.stringify(profiles, null, 2);
}

/**
 * Import profiles from JSON.
 * Merges with existing profiles (doesn't overwrite).
 *
 * @param jsonData - JSON string of profiles array
 * @returns Number of profiles imported
 */
export async function importProfiles(jsonData: string): Promise<number> {
  try {
    const importedProfiles = JSON.parse(jsonData) as SpeakerProfile[];
    const existingProfiles = await getSpeakerProfiles();
    const existingIds = new Set(existingProfiles.map((p) => p.id));

    let imported = 0;
    for (const profile of importedProfiles) {
      // Skip if profile with same ID already exists
      if (!existingIds.has(profile.id)) {
        await saveSpeakerProfile(profile);
        imported++;
      }
    }

    console.log(`[SpeakerProfiles] Imported ${imported} profiles`);
    return imported;
  } catch (error) {
    console.error("[SpeakerProfiles] Import failed:", error);
    throw new Error("Invalid profile data");
  }
}
