import { FolderTree } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArtifactTree } from "./ArtifactTree";
import type { ArtifactTreeProps } from "./types";

type ArtifactTreeMenuProps = ArtifactTreeProps & {
  triggerClassName?: string;
};

export function ArtifactTreeMenu({
  roots,
  selectedFilePath,
  onSelectFile,
  onRefresh,
  direction = "rtl",
  showPath = false,
  showHeader = true,
  triggerClassName,
}: ArtifactTreeMenuProps) {
  const { t } = useTranslation("pages");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-500",
            triggerClassName,
          )}
          title={t("articles.artifactTree.button")}
        >
          <FolderTree className="size-3.5" />
          {t("articles.artifactTree.button")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[24rem] p-2"
      >
        <ArtifactTree
          roots={roots}
          selectedFilePath={selectedFilePath}
          onSelectFile={onSelectFile}
          onRefresh={onRefresh}
          direction={direction}
          showPath={showPath}
          showHeader={showHeader}
        />
      </PopoverContent>
    </Popover>
  );
}