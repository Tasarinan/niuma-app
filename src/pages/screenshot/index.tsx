import { ScreenshotConfigs } from "./components";
import { useSettings } from "@/hooks";
import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";

const Settings = () => {
  const settings = useSettings();
  const { t } = useTranslation("pages");
  return (
    <PageLayout
      title={t("screenshotPage.title")}
      description={t("screenshotPage.description")}
    >
      {/* Screenshot Configs */}
      <ScreenshotConfigs {...settings} />
    </PageLayout>
  );
};

export default Settings;
