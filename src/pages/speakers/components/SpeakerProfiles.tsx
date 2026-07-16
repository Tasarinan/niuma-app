import { useState, useEffect } from "react";
import { Button, Header } from "@/components";
import { Input } from "@/components/ui/input";
import {
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  deleteSpeakerProfile,
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
  const { t } = useTranslation("pages");
  const [unconfirmedProfiles, setUnconfirmedProfiles] = useState<SpeakerProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"colleague" | "client" | "other">("colleague");

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const unconfirmed = await getUnconfirmedProfiles();
    setUnconfirmedProfiles(unconfirmed);
  }

  async function handleDeleteProfile(id: string) {
    await deleteSpeakerProfile(id);
    await loadProfiles();
  }

  async function handleSaveEdit(profile: SpeakerProfile) {
    if (!editName.trim()) return;

    await confirmProfile(profile.id, editName.trim(), editType);

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

  return (
    <div className="space-y-6">
      {/* Unnamed Speakers (Auto-Detected) */}
      {unconfirmedProfiles.length > 0 && (
        <div className="space-y-3">
          <Header
            title={t("speakersPage.profiles.unnamed", { count: unconfirmedProfiles.length })}
            description={t("speakersPage.profiles.unnamedDesc")}
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
                          placeholder={t("speakersPage.profiles.namePlaceholder")}
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
                          <option value="colleague">{t("speakersPage.profiles.colleague")}</option>
                          <option value="client">{t("speakersPage.profiles.client")}</option>
                          <option value="other">{t("speakersPage.profiles.other")}</option>
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
                            {t("speakersPage.profiles.voiceHz", { hz: profile.pitchProfile.avgHz.toFixed(0) })}
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
                        title={t("speakersPage.profiles.confirmName")}
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEditing}
                        title={t("speakersPage.profiles.cancel")}
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
                        title={t("speakersPage.profiles.nameSpeaker")}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteProfile(profile.id)}
                        title={t("speakersPage.profiles.deleteProfile")}
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
    </div>
  );
}
