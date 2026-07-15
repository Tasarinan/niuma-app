import { useApp, useTheme } from "@/store";
import { Header, Label, Slider, Button } from "@/components";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components";

export const Theme = () => {
  const { theme, transparency, setTheme, onSetTransparency } = useTheme();
  const { hasActiveLicense } = useApp();
  const { t } = useTranslation("pages");

  return (
    <div id="theme" className="relative space-y-3">
      <Header
        title={`${t("settingsPage.theme.title")} ${hasActiveLicense ? "" : t("settingsPage.theme.licenseRequired")}`}
        description={t("settingsPage.theme.description")}
        isMainTitle
      />

      {/* Theme Toggle */}
      <div
        className={`space-y-2 ${
          hasActiveLicense ? "" : "opacity-60 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                {theme === "system" ? (
                  <>
                    <MonitorIcon className="h-4 w-4" />
                    {t("settingsPage.theme.system")}
                  </>
                ) : theme === "light" ? (
                  <>
                    <SunIcon className="h-4 w-4" />
                    {t("settingsPage.theme.light")}
                  </>
                ) : (
                  <>
                    <MoonIcon className="h-4 w-4" />
                    {t("settingsPage.theme.dark")}
                  </>
                )}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {theme === "light"
                  ? t("settingsPage.theme.lightDesc")
                  : t("settingsPage.theme.darkDesc")}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {theme === "system" ? (
                  <MonitorIcon className="h-[1.2rem] w-[1.2rem]" />
                ) : (
                  <>
                    <SunIcon className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                    <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                {t("settingsPage.theme.lightBtn")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                {t("settingsPage.theme.darkBtn")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                {t("settingsPage.theme.systemBtn")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Transparency Slider */}
      <div
        className={`space-y-2 ${
          hasActiveLicense ? "" : "opacity-60 pointer-events-none"
        }`}
      >
        <Header
          title={t("settingsPage.theme.transparency")}
          description={t("settingsPage.theme.transparencyDesc")}
        />
        <div className="space-y-3">
          <div className="flex items-center gap-4 mt-4">
            <Slider
              value={[transparency]}
              onValueChange={(value: number[]) => onSetTransparency(value[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
          </div>

          <p className="text-xs text-muted-foreground/70">
            {t("settingsPage.theme.transparencyTip")}
          </p>
        </div>
      </div>
    </div>
  );
};
