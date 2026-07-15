import { useLocaleStore } from "@/store";
import { Header, Button } from "@/components";
import { Languages } from "lucide-react";

export const LocaleToggle = () => {
  const { language, setLanguage } = useLocaleStore();

  return (
    <div id="locale" className="space-y-3">
      <Header
        title="Language / 语言"
        description="Switch the interface language"
        isMainTitle
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {language === "zh" ? "中文" : "English"}
            </p>
            <p className="text-xs text-muted-foreground">
              {language === "zh"
                ? "当前语言：简体中文"
                : "Current language: English"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={language === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage("en")}
          >
            English
          </Button>
          <Button
            variant={language === "zh" ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage("zh")}
          >
            中文
          </Button>
        </div>
      </div>
    </div>
  );
};
