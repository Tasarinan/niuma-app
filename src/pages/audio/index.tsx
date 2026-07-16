import { AudioSelection, VadSensitivitySettings } from "./components";
import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";

const Audio = () => {
  const { t } = useTranslation("pages");
  return (
    <PageLayout
      title={t("audioPage.title")}
      description={t("audioPage.description")}
    >
      <AudioSelection />
      <VadSensitivitySettings />
    </PageLayout>
  );
};

export default Audio;
