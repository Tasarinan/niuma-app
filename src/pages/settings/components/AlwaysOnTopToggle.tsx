import { Switch, Label, Header } from "@/components";
import { useApp } from "@/store";
import { useTranslation } from "react-i18next";

interface AlwaysOnTopToggleProps {
  className?: string;
}

export const AlwaysOnTopToggle = ({ className }: AlwaysOnTopToggleProps) => {
  const { customizable, toggleAlwaysOnTop } = useApp();
  const { t } = useTranslation("pages");

  const handleSwitchChange = async (checked: boolean) => {
    await toggleAlwaysOnTop(checked);
  };

  return (
    <div id="always-on-top" className={`space-y-2 ${className}`}>
      <Header
        title={t("settingsPage.alwaysOnTop.title")}
        description={t("settingsPage.alwaysOnTop.description")}
        isMainTitle
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div>
            <Label className="text-sm font-medium">
              {customizable.alwaysOnTop.isEnabled
                ? t("settingsPage.alwaysOnTop.disable")
                : t("settingsPage.alwaysOnTop.enable")}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {customizable.alwaysOnTop.isEnabled
                ? t("settingsPage.alwaysOnTop.enabledDesc")
                : t("settingsPage.alwaysOnTop.disabledDesc")}
            </p>
          </div>
        </div>
        <Switch
          checked={customizable.alwaysOnTop.isEnabled}
          onCheckedChange={handleSwitchChange}
          title={!customizable.alwaysOnTop.isEnabled ? t("settingsPage.alwaysOnTop.toggleEnabled") : t("settingsPage.alwaysOnTop.toggleDisabled")}
          aria-label={customizable.alwaysOnTop.isEnabled ? t("settingsPage.alwaysOnTop.toggleEnabled") : t("settingsPage.alwaysOnTop.toggleDisabled")}
        />
      </div>
    </div>
  );
};
