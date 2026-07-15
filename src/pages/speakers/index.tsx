import { PageLayout } from "@/components/layouts";
import { DiarizationSettings, SpeakerProfiles } from "./components";
import { useTranslation } from "react-i18next";

const Speakers = () => {
  const { t } = useTranslation("pages");
  return (
    <PageLayout
      title={t("speakersPage.title")}
      description={t("speakersPage.description")}
    >
      {/* Speaker Diarization Settings */}
      <DiarizationSettings />

      {/* Speaker Profiles for Voice Enrollment */}
      <SpeakerProfiles />
    </PageLayout>
  );
};

export default Speakers;
