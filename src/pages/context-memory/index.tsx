import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";
import { ContextSettings, TeamMemoryPanel } from "./components";

const ContextMemory = () => {
  const { t } = useTranslation("pages");

  return (
    <PageLayout
      title={t("contextMemoryPage.title")}
      description={t("contextMemoryPage.description")}
    >
      <div className="max-w-2xl space-y-8">
        {/* PI file-based team memory */}
        <TeamMemoryPanel />
        {/* Legacy meeting context memory settings */}
        <ContextSettings />
      </div>
    </PageLayout>
  );
};

export default ContextMemory;
