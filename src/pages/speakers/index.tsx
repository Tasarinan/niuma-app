import { PageLayout } from "@/layouts";
import { DiarizationSettings, SpeakerProfiles } from "./components";

const Speakers = () => {
  return (
    <PageLayout
      title="Speakers"
      description="Manage speaker identification and voice profiles for meetings"
    >
      {/* Speaker Diarization Settings */}
      <DiarizationSettings />

      {/* Speaker Profiles for Voice Enrollment */}
      <SpeakerProfiles />
    </PageLayout>
  );
};

export default Speakers;
