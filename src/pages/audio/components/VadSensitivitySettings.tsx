import { useEffect, useState } from "react";
import { Header, Label, Slider } from "@/components";
import { useTranslation } from "react-i18next";
import {
  getMeetingVadSettings,
  setMeetingVadSettings,
  DEFAULT_MEETING_VAD_SETTINGS,
  type MeetingVadSettings,
} from "@/lib/storage";

/**
 * Lets the user tune how sensitive the Meeting Channel's system-audio voice
 * detection is. Centralizes what used to be an unreachable control buried in
 * the orphaned speech/VadConfigPanel.tsx - this now actually drives
 * useMeetingAudio.ts's capture pipeline.
 */
export const VadSensitivitySettings = () => {
  const { t } = useTranslation("pages");
  const [settings, setSettings] = useState<MeetingVadSettings>(DEFAULT_MEETING_VAD_SETTINGS);

  useEffect(() => {
    setSettings(getMeetingVadSettings());
  }, []);

  const handleUpdate = (updates: Partial<MeetingVadSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    setMeetingVadSettings(next);
  };

  return (
    <div className="space-y-4">
      <Header
        isMainTitle={false}
        title={t("audioPage.vadSensitivity")}
        description={t("audioPage.vadSensitivityDesc")}
      />

      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center justify-between">
          <span>{t("audioPage.vadSensitivityLabel")}</span>
          <span className="text-muted-foreground font-normal">
            {(settings.sensitivityRms * 1000).toFixed(1)}
          </span>
        </Label>
        <Slider
          value={[settings.sensitivityRms * 1000]}
          onValueChange={([value]) => handleUpdate({ sensitivityRms: value / 1000 })}
          min={1}
          max={10}
          step={0.5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">{t("audioPage.vadSensitivityHint")}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center justify-between">
          <span>{t("audioPage.vadSilenceLabel")}</span>
          <span className="text-muted-foreground font-normal">
            {((settings.silenceChunks * 1024) / 44100).toFixed(1)}s
          </span>
        </Label>
        <Slider
          value={[settings.silenceChunks]}
          onValueChange={([value]) => handleUpdate({ silenceChunks: Math.round(value) })}
          min={15}
          max={180}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">{t("audioPage.vadSilenceHint")}</p>
      </div>
    </div>
  );
};
