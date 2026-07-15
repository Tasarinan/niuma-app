import {
  Header,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components";
import { useApp } from "@/store";
import { getPlatform } from "@/lib";
import { CursorType } from "@/lib/storage";
import { MousePointer, MousePointer2, Pointer, TextCursor } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CursorSelectionProps {
  className?: string;
}

export const CursorSelection = ({ className }: CursorSelectionProps) => {
  const { customizable, setCursorType } = useApp();
  const platform = getPlatform();
  const { t } = useTranslation("pages");

  return (
    <div id="cursor" className={`space-y-2 ${className}`}>
      <Header
        title={t("shortcutsPage.cursor.title")}
        description={t("shortcutsPage.cursor.description")}
        isMainTitle
        rightSlot={
          <Select
            value={customizable.cursor.type}
            onValueChange={(value) => setCursorType(value as CursorType)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("shortcutsPage.cursor.selectType")} />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="invisible" disabled={platform === "linux"}>
                {t("shortcutsPage.cursor.invisible")} (<MousePointer2 className="size-3 px-0" />){" "}
                {platform === "linux" && (
                  <span className="text-xs text-muted-foreground">
                    {t("shortcutsPage.cursor.notSupportedLinux")}
                  </span>
                )}
              </SelectItem>
              <SelectItem value="default">
                {t("shortcutsPage.cursor.default")} (<MousePointer className="size-3" />)
              </SelectItem>
              <SelectItem value="auto">
                {t("shortcutsPage.cursor.auto")} (
                <MousePointer className="size-3" />/
                <TextCursor className="size-3" /> /
                <Pointer className="size-3" />)
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
};
