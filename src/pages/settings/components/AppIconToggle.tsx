import { Switch, Label, Header } from "@/components";
import { useApp } from "@/store";
import { useTranslation } from "react-i18next";

interface AppIconToggleProps {
  className?: string;
}

export const AppIconToggle = ({ className }: AppIconToggleProps) => {
  const { customizable, toggleAppIconVisibility } = useApp();
  const { t } = useTranslation("pages");

  const handleSwitchChange = async (checked: boolean) => {
    await toggleAppIconVisibility(checked);
  };

  return (
    <div id="app-icon" className={`space-y-2 ${className}`}>
      <Header
        title={t("settingsPage.appIcon.title")}
        description={t("settingsPage.appIcon.description")}
        isMainTitle
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div>
            <Label className="text-sm font-medium">
              {!customizable.appIcon.isVisible
                ? t("settingsPage.appIcon.show")
                : t("settingsPage.appIcon.hide")}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {!customizable.appIcon.isVisible
                ? t("settingsPage.appIcon.toggleShow")
                : t("settingsPage.appIcon.toggleHide")}
            </p>
          </div>
        </div>
        <Switch
          checked={customizable.appIcon.isVisible}
          onCheckedChange={handleSwitchChange}
          aria-label="Toggle app icon visibility"
        />
      </div>
    </div>
  );
};
