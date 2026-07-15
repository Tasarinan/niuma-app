import { CursorSelection, ShortcutManager } from "./components";
import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";

const Shortcuts = () => {
  const { t } = useTranslation("pages");
  return (
    <PageLayout
      title={t("shortcutsPage.title")}
      description={t("shortcutsPage.description")}
    >
      <div className="flex flex-col gap-6 pb-8">
        {/* Cursor Selection */}
        <CursorSelection />

        {/* Keyboard Shortcuts */}
        <ShortcutManager />
      </div>
    </PageLayout>
  );
};

export default Shortcuts;
