import { AutoScrollToggle } from "./components";
import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";

const Responses = () => {
  const { t } = useTranslation("pages");

  return (
    <PageLayout
      title={t("responsesPage.title")}
      description={t("responsesPage.description")}
    >
      {/* Auto-Scroll Toggle */}
      <AutoScrollToggle />
    </PageLayout>
  );
};

export default Responses;
