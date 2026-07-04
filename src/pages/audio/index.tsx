import { AudioSelection } from "./components";
import { PageLayout } from "@/layouts";

const Audio = () => {
  return (
    <PageLayout
      title="Audio Settings"
      description="Configure your audio input and output devices for voice interaction and system audio capture."
    >
      <AudioSelection />
    </PageLayout>
  );
};

export default Audio;
