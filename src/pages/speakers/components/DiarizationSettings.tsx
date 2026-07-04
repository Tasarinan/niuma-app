import { useState, useEffect } from "react";
import { Header } from "@/components";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InfoIcon, UsersIcon, DollarSignIcon, KeyIcon } from "lucide-react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage, secureGet, secureSet, migrateFromLocalStorage } from "@/lib";

export function DiarizationSettings() {
  const [diarizationEnabled, setDiarizationEnabled] = useState(() => {
    return safeLocalStorage.getItem(STORAGE_KEYS.SPEAKER_DIARIZATION_ENABLED) === "true";
  });

  const [assemblyAIKey, setAssemblyAIKey] = useState("");
  const [isLoadingKey, setIsLoadingKey] = useState(true);

  // Load API key from secure storage on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        // Migrate from localStorage if exists
        await migrateFromLocalStorage(STORAGE_KEYS.ASSEMBLYAI_API_KEY, true);

        // Load from secure storage
        const key = await secureGet(STORAGE_KEYS.ASSEMBLYAI_API_KEY);
        setAssemblyAIKey(key || "");
      } catch (error) {
        console.error("[DiarizationSettings] Failed to load API key from secure storage:", error);
        toast.error("Failed to load API key", {
          description: "Secure storage error. Please restart the application.",
        });
        // DO NOT fallback to localStorage - this would defeat the security purpose
        setAssemblyAIKey("");
      } finally {
        setIsLoadingKey(false);
      }
    };

    loadApiKey();
  }, []);

  useEffect(() => {
    safeLocalStorage.setItem(
      STORAGE_KEYS.SPEAKER_DIARIZATION_ENABLED,
      String(diarizationEnabled)
    );
  }, [diarizationEnabled]);

  // Save API key to secure storage (not localStorage!)
  useEffect(() => {
    if (isLoadingKey) return; // Skip initial load

    const saveApiKey = async () => {
      try {
        if (assemblyAIKey) {
          await secureSet(STORAGE_KEYS.ASSEMBLYAI_API_KEY, assemblyAIKey);
        } else {
          // Clear if empty
          await secureSet(STORAGE_KEYS.ASSEMBLYAI_API_KEY, "");
        }
      } catch (error) {
        console.error("[DiarizationSettings] CRITICAL: Failed to save API key to secure storage:", error);
        toast.error("Failed to save API key", {
          description: "Secure storage error. Your API key was not saved. Please try again or restart the application.",
        });
        // DO NOT fallback to localStorage - this would defeat the security purpose
        // User will need to re-enter the key or restart the application
      }
    };

    saveApiKey();
  }, [assemblyAIKey, isLoadingKey]);

  return (
    <div className="space-y-4">
      <Header
        title="Speaker Diarization"
        description="Automatically identify who is speaking in your meetings."
      />

      <div className="p-4 border rounded-lg space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="diarization-toggle" className="font-medium">
              Enable Speaker Diarization
            </Label>
            <p className="text-xs text-muted-foreground">
              Identify different speakers in meeting transcripts
            </p>
          </div>
          <Switch
            id="diarization-toggle"
            checked={diarizationEnabled}
            onCheckedChange={setDiarizationEnabled}
          />
        </div>

        {diarizationEnabled && (
          <>
            <div className="h-px bg-border" />

            {/* API Key Configuration */}
            <div className="space-y-2">
              <Label htmlFor="assemblyai-key" className="font-medium flex items-center gap-2">
                <KeyIcon className="h-4 w-4" />
                AssemblyAI API Key
              </Label>
              <Input
                id="assemblyai-key"
                type="password"
                placeholder="Enter your AssemblyAI API key..."
                value={assemblyAIKey}
                onChange={(e) => setAssemblyAIKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://www.assemblyai.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  assemblyai.com
                </a>
              </p>
              {!assemblyAIKey && (
                <p className="text-xs text-orange-600">
                  ⚠️ API key required for diarization to work
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Requirements Info */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <InfoIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Requirements</p>
                  <p className="text-muted-foreground">
                    Speaker diarization requires AssemblyAI as your STT provider.
                    Select "AssemblyAI (with Speaker Diarization)" in STT Providers above.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                <DollarSignIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Pricing</p>
                  <p className="text-muted-foreground">
                    AssemblyAI Universal with Speaker Labels: $0.17/hr ($0.00283/min)
                  </p>
                  <p className="text-muted-foreground">
                    This includes the base transcription + speaker diarization addon.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                <UsersIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">How it works</p>
                  <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>Your microphone audio is labeled as "You"</li>
                    <li>System audio (guests) is analyzed every 30 seconds</li>
                    <li>Voice pitch is analyzed to automatically identify speakers</li>
                    <li>Unknown speakers are auto-created as "Speaker N (Unnamed)"</li>
                    <li>Name them in the Speakers page for persistent recognition</li>
                    <li>Once named, they'll be recognized automatically in future meetings</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
