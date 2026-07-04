import { useState, useEffect } from "react";
import { Button, Header } from "@/components";
import { Input } from "@/components/ui/input";
import {
  TrashIcon,
  UserIcon,
  PlusIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import {
  saveSpeakerProfile,
  deleteSpeakerProfile,
  getUserProfile,
  getOtherProfiles,
  createSpeakerProfile,
  SpeakerProfile,
  getUnconfirmedProfiles,
  confirmProfile,
} from "@/lib/storage/speaker-profiles.storage";

/**
 * Simplified Speaker Profiles component.
 *
 * This component manages speaker profiles for manual tagging in transcripts.
 * Voice enrollment has been removed - speakers are now identified through:
 * 1. Audio source (microphone = "You", system audio = "Guest")
 * 2. Batch diarization (distinguishes multiple guests as Speaker 1, 2, etc.)
 * 3. Manual tagging via SpeakerTaggingPopover
 */
export function SpeakerProfiles() {
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [userProfile, setUserProfile] = useState<SpeakerProfile | null>(null);
  const [unconfirmedProfiles, setUnconfirmedProfiles] = useState<SpeakerProfile[]>([]);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileType, setNewProfileType] = useState<"colleague" | "client" | "other">("colleague");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"colleague" | "client" | "other">("colleague");

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const user = await getUserProfile();
    const others = await getOtherProfiles();
    const unconfirmed = await getUnconfirmedProfiles();
    setUserProfile(user || null);
    setProfiles(others.filter(p => p.isConfirmed)); // Only confirmed profiles in "Other Speakers"
    setUnconfirmedProfiles(unconfirmed);
  }

  async function handleAddProfile() {
    if (!newProfileName.trim()) return;

    const profile = createSpeakerProfile(newProfileName.trim(), newProfileType);
    await saveSpeakerProfile(profile);
    await loadProfiles();

    setNewProfileName("");
    setShowAddProfile(false);
  }

  async function handleDeleteProfile(id: string) {
    await deleteSpeakerProfile(id);
    await loadProfiles();
  }

  async function handleSaveEdit(profile: SpeakerProfile) {
    if (!editName.trim()) return;

    // For confirmed profiles, just update the name
    if (profile.isConfirmed) {
      profile.name = editName.trim();
      profile.lastSeenAt = Date.now();
      await saveSpeakerProfile(profile);
    } else {
      // For unconfirmed profiles, confirm them with the new name
      await confirmProfile(profile.id, editName.trim(), editType);
    }

    await loadProfiles();
    setEditingProfile(null);
    setEditName("");
    setEditType("colleague");
  }

  function startEditing(profile: SpeakerProfile) {
    setEditingProfile(profile.id);
    setEditName(profile.name);
    setEditType(profile.type as "colleague" | "client" | "other");
  }

  function cancelEditing() {
    setEditingProfile(null);
    setEditName("");
    setEditType("colleague");
  }


  async function ensureUserProfile() {
    if (userProfile) return;

    const profile = createSpeakerProfile("You", "user");
    profile.color = "#3b82f6";
    await saveSpeakerProfile(profile);
    setUserProfile(profile);
  }

  return (
    <div className="space-y-6">
      {/* User Profile */}
      <div className="space-y-3">
        <Header
          title="Your Profile"
          description="Your profile is used to label your speech in meeting transcripts."
        />

        <div className="p-4 border rounded-lg">
          {userProfile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">You</p>
                  <p className="text-xs text-muted-foreground">
                    Microphone audio is automatically labeled as you
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Create your profile to be identified in transcripts.
              </p>
              <Button onClick={ensureUserProfile}>
                <UserIcon className="h-4 w-4 mr-2" />
                Create Profile
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unnamed Speakers (Auto-Detected) */}
      {unconfirmedProfiles.length > 0 && (
        <div className="space-y-3">
          <Header
            title={`Unnamed Speakers (${unconfirmedProfiles.length})`}
            description="Speakers automatically detected during meetings. Name them to make identification persistent."
          />

          <div className="space-y-2">
            {unconfirmedProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-start justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 mt-0.5"
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingProfile === profile.id ? (
                      <div className="space-y-2">
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(profile);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          placeholder="Enter speaker name..."
                          className="h-8"
                          autoFocus
                        />
                        <select
                          value={editType}
                          onChange={(e) =>
                            setEditType(
                              e.target.value as "colleague" | "client" | "other"
                            )
                          }
                          className="px-2 py-1 border rounded text-sm bg-background w-full"
                        >
                          <option value="colleague">Colleague</option>
                          <option value="client">Client</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-sm">{profile.name}</p>
                        {profile.sampleTranscript && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            "{profile.sampleTranscript}..."
                          </p>
                        )}
                        {profile.pitchProfile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Voice: {profile.pitchProfile.avgHz.toFixed(0)} Hz
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {editingProfile === profile.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600"
                        onClick={() => handleSaveEdit(profile)}
                        title="Confirm name"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEditing}
                        title="Cancel"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(profile)}
                        title="Name this speaker"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteProfile(profile.id)}
                        title="Delete profile"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Speaker Profiles */}
      <div className="space-y-3">
        <Header
          title="Other Speakers"
          description="Pre-define speaker names for quick tagging during meetings."
        />

        {profiles.length === 0 && !showAddProfile ? (
          <p className="text-sm text-muted-foreground py-2">
            No other speakers added yet. Speakers will be labeled automatically during meetings,
            but you can add names here for quick tagging.
          </p>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  {editingProfile === profile.id ? (
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(profile);
                        if (e.key === "Escape") cancelEditing();
                      }}
                      className="flex-1 h-8"
                      autoFocus
                    />
                  ) : (
                    <div>
                      <p className="font-medium text-sm">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.type}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {editingProfile === profile.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600"
                        onClick={() => handleSaveEdit(profile)}
                        title="Save"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEditing}
                        title="Cancel"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(profile)}
                        title="Edit name"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteProfile(profile.id)}
                        title="Delete profile"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new profile form */}
        {showAddProfile ? (
          <div className="p-3 border rounded-lg space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Name (e.g., Sarah Chen)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddProfile();
                  if (e.key === "Escape") {
                    setShowAddProfile(false);
                    setNewProfileName("");
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <select
                value={newProfileType}
                onChange={(e) =>
                  setNewProfileType(
                    e.target.value as "colleague" | "client" | "other"
                  )
                }
                className="px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="colleague">Colleague</option>
                <option value="client">Client</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddProfile}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Profile
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddProfile(false);
                  setNewProfileName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddProfile(true)}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Speaker
          </Button>
        )}
      </div>
    </div>
  );
}
