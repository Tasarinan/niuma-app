import { Switch, Label, Header } from "@/components";
import { useApp } from "@/store";
import { useTranslation } from "react-i18next";

interface AutostartToggleProps {
  className?: string;
}

export const AutostartToggle = ({ className }: AutostartToggleProps) => {
  const { customizable, toggleAutostart } = useApp();
  const { t } = useTranslation("pages");

  const isEnabled = customizable?.autostart?.isEnabled ?? true;

  const handleSwitchChange = async (checked: boolean) => {
    await toggleAutostart(checked);
  };

  return (
    <div id="autostart" className={`space-y-2 ${className}`}>
      <Header
        title={t("settingsPage.autostart.title")}
        description={t("settingsPage.autostart.description")}
        isMainTitle
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div>
            <Label className="text-sm font-medium">{t("settingsPage.autostart.label")}</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {isEnabled
                ? t("settingsPage.autostart.enabled")
                : t("settingsPage.autostart.disabled")}
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleSwitchChange}
          aria-label="Toggle autostart"
        />
      </div>
    </div>
  );
};
