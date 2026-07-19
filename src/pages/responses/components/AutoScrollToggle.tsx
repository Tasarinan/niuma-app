import { Switch, Label, Header } from "@/components";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store";
import { updateAutoScroll } from "@/lib/storage/response-settings.storage";
import { useState, useEffect } from "react";
import { getResponseSettings } from "@/lib";

export const AutoScrollToggle = () => {
  const { t } = useTranslation("pages");
  const { hasActiveLicense } = useApp();
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  useEffect(() => {
    const settings = getResponseSettings();
    setAutoScroll(settings.autoScroll);
  }, []);

  const handleSwitchChange = (checked: boolean) => {
    if (!hasActiveLicense) {
      return;
    }
    setAutoScroll(checked);
    updateAutoScroll(checked);
  };

  return (
    <div className="space-y-4">
      <Header
        title={t("responsesPage.autoScroll.title")}
        description={t("responsesPage.autoScroll.description")}
        isMainTitle
      />

      <div className="flex items-center justify-between p-4 border rounded-xl">
        <div className="flex items-center space-x-3">
          <div>
            <Label className="text-sm font-medium">
              {autoScroll ? t("responsesPage.autoScroll.enabled") : t("responsesPage.autoScroll.disabled")}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {autoScroll
                ? t("responsesPage.autoScroll.enabledDesc")
                : t("responsesPage.autoScroll.disabledDesc")}
            </p>
          </div>
        </div>
        <Switch
          checked={autoScroll}
          onCheckedChange={handleSwitchChange}
          disabled={!hasActiveLicense}
          title={`Toggle to ${!autoScroll ? "enable" : "disable"} auto-scroll`}
          aria-label={`Toggle to ${
            autoScroll ? "disable" : "enable"
          } auto-scroll`}
        />
      </div>
    </div>
  );
};
