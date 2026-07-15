import { ResponseLength, AutoScrollToggle } from "./components";
import { PageLayout } from "@/components/layouts";
import { useApp } from "@/store";
import { useTranslation } from "react-i18next";

const Responses = () => {
  const { hasActiveLicense } = useApp();
  const { t } = useTranslation("pages");

  return (
    <PageLayout
      title={t("responsesPage.title")}
      description={t("responsesPage.description")}
    >
      {!hasActiveLicense && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-[10px] lg:text-sm text-foreground font-medium mb-2">
            {t("responsesPage.premiumTitle")}
          </p>
          <p className="text-[10px] lg:text-sm text-muted-foreground">
            {t("responsesPage.premiumDesc")}
          </p>
        </div>
      )}

      {/* Response Length */}
      <ResponseLength />

      {/* Auto-Scroll Toggle */}
      <AutoScrollToggle />
    </PageLayout>
  );
};

export default Responses;
