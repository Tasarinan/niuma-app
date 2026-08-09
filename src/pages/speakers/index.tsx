import { useMemo } from "react";
import { Header, Selection, Switch } from "@/components";
import { PageLayout } from "@/components/layouts";
import { STT_LANGUAGES, TRANSLATION_LANGUAGES } from "@/config";
import { providerSupportsAutoDetect } from "@/lib/functions/stt.function";
import { useApp } from "@/store";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks";
import { DiarizationSettings, SpeakerProfiles, STTProviders } from "./components";

// Speech Recognition settings page - consolidates STT provider, language and speaker settings
const Speakers = () => {
  const { t } = useTranslation("pages");
  const {
    sttLanguage,
    setSttLanguage,
    sttTranslationEnabled,
    setSttTranslationEnabled,
    sttTranslationLanguage,
    setSttTranslationLanguage,
    selectedSttProvider,
    allSttProviders,
  } = useApp();
  const settings = useSettings();

  // Check if current STT provider supports auto-detect
  const currentSttProvider = useMemo(() => {
    return allSttProviders.find((p) => p.id === selectedSttProvider.provider);
  }, [allSttProviders, selectedSttProvider.provider]);

  const showAutoDetectWarning = useMemo(() => {
    const isAutoDetect = sttLanguage === "auto" || sttLanguage === "";
    return isAutoDetect && currentSttProvider && !providerSupportsAutoDetect(currentSttProvider);
  }, [sttLanguage, currentSttProvider]);

  return (
    <PageLayout
      title={t("speechRecognitionPage.title")}
      description={t("speechRecognitionPage.description")}
    >
      {/* STT Provider & API Key Section */}
      <STTProviders {...settings} />

      {/* Speech Recognition Language Section */}
      <div className="space-y-4 pt-4 border-t">
        <Header
          title={t("languagePage.sttTitle")}
          description={t("languagePage.sttDesc")}
          isMainTitle
        />
        <div className="max-w-md">
          <Selection
            selected={sttLanguage}
            options={[
              { label: t("languagePage.autoDetect"), value: "auto" },
              ...STT_LANGUAGES.map((lang) => ({
                label: lang.name,
                value: lang.code,
              })),
            ]}
            placeholder={t("languagePage.chooseLanguage")}
            onChange={(value) => {
              setSttLanguage(value);
            }}
          />
        </div>

        {/* Warning when auto-detect is selected with incompatible provider */}
        {showAutoDetectWarning && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-[10px] lg:text-xs text-yellow-600 dark:text-yellow-400">
              {t("languagePage.sttWarning")}
            </p>
          </div>
        )}
      </div>

      {/* Speaker Diarization Settings */}
      <div className="pt-4 border-t">
        <DiarizationSettings />
      </div>

      {/* Speaker Profiles for Voice Enrollment */}
      <SpeakerProfiles />

      {/* Speech Translation Section */}
      <div className="space-y-4 pt-4 border-t">
        <Header
          title={t("languagePage.translation")}
          description={t("languagePage.translationDesc")}
          isMainTitle
        />

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("languagePage.enableTranslation")}</span>
            <span className="text-xs text-muted-foreground">
              {t("languagePage.enableTranslationDesc")}
            </span>
          </div>
          <Switch
            checked={sttTranslationEnabled}
            onCheckedChange={setSttTranslationEnabled}
          />
        </div>

        {sttTranslationEnabled && (
          <div className="space-y-2">
            <Header
              title={t("languagePage.targetLanguage")}
              description={t("languagePage.targetLanguageDesc")}
            />
            <Selection
              selected={sttTranslationLanguage}
              options={TRANSLATION_LANGUAGES.map((lang) => ({
                label: lang.name,
                value: lang.code,
              }))}
              placeholder={t("languagePage.chooseTarget")}
              onChange={(value) => {
                setSttTranslationLanguage(value);
              }}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Speakers;
