import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";
import { ContextSettings } from "./components";

const ContextMemory = () => {
  const { t } = useTranslation("pages");

  return (
    <PageLayout
      title={t("contextMemoryPage.title")}
      description={t("contextMemoryPage.description")}
    >
      <div className="max-w-2xl">
        <ContextSettings />
      </div>
    </PageLayout>
  );
};

export default ContextMemory;
