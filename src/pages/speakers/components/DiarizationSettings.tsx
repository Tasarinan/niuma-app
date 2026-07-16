import { useState, useEffect } from "react";
import { Header } from "@/components";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InfoIcon, UsersIcon, DollarSignIcon, KeyIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage, secureGet, secureSet, migrateFromLocalStorage } from "@/lib";

export function DiarizationSettings() {
  const { t } = useTranslation("pages");
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
        toast.error(t("speakersPage.diarization.loadKeyError"), {
          description: t("speakersPage.diarization.loadKeyErrorDesc"),
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
        toast.error(t("speakersPage.diarization.saveKeyError"), {
          description: t("speakersPage.diarization.saveKeyErrorDesc"),
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
        title={t("speakersPage.diarization.title")}
        description={t("speakersPage.diarization.description")}
      />

      <div className="p-4 border rounded-lg space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="diarization-toggle" className="font-medium">
              {t("speakersPage.diarization.enable")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("speakersPage.diarization.enableDesc")}
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
                {t("speakersPage.diarization.apiKeyLabel")}
              </Label>
              <Input
                id="assemblyai-key"
                type="password"
                placeholder={t("speakersPage.diarization.apiKeyPlaceholder")}
                value={assemblyAIKey}
                onChange={(e) => setAssemblyAIKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("speakersPage.diarization.apiKeyHint")}{" "}
                <a
                  href="https://www.assemblyai.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("speakersPage.diarization.apiKeyLink")}
                </a>
              </p>
              {!assemblyAIKey && (
                <p className="text-xs text-orange-600">
                  {t("speakersPage.diarization.apiKeyWarning")}
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Requirements Info */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <InfoIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{t("speakersPage.diarization.requirements")}</p>
                  <p className="text-muted-foreground">
                    {t("speakersPage.diarization.requirementsDesc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                <DollarSignIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{t("speakersPage.diarization.pricing")}</p>
                  <p className="text-muted-foreground">
                    {t("speakersPage.diarization.pricingDesc")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("speakersPage.diarization.pricingNote")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                <UsersIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{t("speakersPage.diarization.howItWorks")}</p>
                  <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>{t("speakersPage.diarization.howItWorksMic")}</li>
                    <li>{t("speakersPage.diarization.howItWorksSystemAudio")}</li>
                    <li>{t("speakersPage.diarization.howItWorksPitch")}</li>
                    <li>{t("speakersPage.diarization.howItWorksAutoCreate")}</li>
                    <li>{t("speakersPage.diarization.howItWorksName")}</li>
                    <li>{t("speakersPage.diarization.howItWorksFuture")}</li>
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
