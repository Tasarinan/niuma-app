import { Button } from "@/components";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const getInstructionsForPlatform = (
  platform: string,
  t: (key: string) => string
) => {
  if (platform.includes("mac")) {
    return {
      title: t("setupInstructions.macos.title"),
      description: t("setupInstructions.macos.description"),
      buttonText: t("setupInstructions.macos.buttonText"),
      manualTitle: t("setupInstructions.macos.manualTitle"),
      manualSteps: t("setupInstructions.macos.manualSteps"),
      note: t("setupInstructions.macos.note"),
    };
  }
  if (platform.includes("win")) {
    return {
      title: t("setupInstructions.windows.title"),
      description: t("setupInstructions.windows.description"),
      buttonText: t("setupInstructions.windows.buttonText"),
      manualTitle: t("setupInstructions.windows.manualTitle"),
      manualSteps: t("setupInstructions.windows.manualSteps"),
      note: t("setupInstructions.windows.note"),
    };
  }
  if (platform.includes("linux")) {
    return {
      title: t("setupInstructions.linux.title"),
      description: t("setupInstructions.linux.description"),
      buttonText: t("setupInstructions.linux.buttonText"),
      manualTitle: t("setupInstructions.linux.manualTitle"),
      manualSteps: t("setupInstructions.linux.manualSteps"),
      note: t("setupInstructions.linux.note"),
    };
  }
  return {
    title: t("setupInstructions.undetermined.title"),
    description: t("setupInstructions.undetermined.description"),
    buttonText: t("setupInstructions.undetermined.buttonText"),
    manualTitle: t("setupInstructions.undetermined.manualTitle"),
    manualSteps: t("setupInstructions.undetermined.manualSteps"),
    note: undefined as string | undefined,
  };
};

export const SetupInstructions = ({
  setupRequired,
  handleSetup,
}: {
  setupRequired: boolean;
  handleSetup: () => void;
}) => {
  const { t } = useTranslation("pages");
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const platform = navigator.platform.toLowerCase();
  const instructions = getInstructionsForPlatform(platform, t);

  return setupRequired ? (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{instructions.title}</h3>
        <p className="text-md text-muted-foreground">
          {instructions.description}
        </p>
      </div>
      <Button onClick={handleSetup} className="w-full">
        {instructions.buttonText}
      </Button>
    </div>
  ) : (
    <div className="space-y-2">
      <div
        className="flex flex-row justify-between items-center cursor-pointer"
        onClick={() => setShowTroubleshoot(!showTroubleshoot)}
      >
        <div className="flex flex-row gap-2 items-center">
          <p className="font-medium text-sm">{t("setupInstructions.status")}</p>
          <div className="flex flex-row gap-1.5 justify-center items-center">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-muted-foreground">{t("setupInstructions.active")}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTroubleshoot(!showTroubleshoot)}
          className="p-0"
        >
          {t("setupInstructions.troubleshoot")}{" "}
          {showTroubleshoot ? (
            <ArrowUpIcon className="w-4 h-4" />
          ) : (
            <ArrowDownIcon className="w-4 h-4" />
          )}
        </Button>
      </div>

      {showTroubleshoot ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-input/50 pt-3">
          <p className="text-sm font-semibold text-orange-600">
            {instructions.manualTitle}
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
            {instructions.manualSteps}
          </p>
          {instructions.note && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("setupInstructions.notePrefix")}{instructions.note}
            </p>
          )}
          <Button className="w-full" variant="outline" onClick={handleSetup}>
            {t("setupInstructions.troubleshoot")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
