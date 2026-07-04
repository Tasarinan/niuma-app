import { Button } from "@/components";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface Instructions {
  title: string;
  description: string;
  buttonText: string;
  manualTitle: string;
  manualSteps: string;
  note?: string;
}

const osInstructions: Record<string, Instructions> = {
  macos: {
    title: "System Audio Permission Required",
    description:
      "Niuma needs permission to capture your screen's audio. Clicking the button will open System Settings.",
    buttonText: "Open System Settings",
    manualTitle: "If permission is not granted automatically:",
    manualSteps:
      "1. Go to System Settings > Privacy & Security > Screen & System Audio Recording.\n2. Find Niuma in the list and enable it, if not found then click on + and add Niuma.",
    note: "A restart of Niuma may be required after granting permission.",
  },
  windows: {
    title: "System Audio Access",
    description:
      "Niuma needs to access your system audio. The button below will open the Sound settings panel for troubleshooting.",
    buttonText: "Open Sound Settings",
    manualTitle: "To ensure Niuma can capture audio:",
    manualSteps:
      "1. In Sound settings, ensure the correct speakers are set as the default device.\n2. Check your device properties and disable any 'Exclusive Mode' settings.",
    note: "Windows does not require a specific permission prompt for audio capture.",
  },
  linux: {
    title: "System Audio Setup",
    description:
      "Niuma captures audio using PulseAudio. Please ensure it is configured correctly.",
    buttonText: "Setup Instructions",
    manualTitle: "Troubleshooting Steps:",
    manualSteps:
      "1. Make sure you are running a PulseAudio server.\n2. Check your system's sound settings and ensure the correct output device is set as default.",
    note: "There is no automatic setup for Linux. Access depends on your system's audio configuration.",
  },
  undetermined: {
    title: "System Audio Permission",
    description: "Niuma needs permission to capture system audio.",
    buttonText: "Grant Permission",
    manualTitle: "Manual Setup:",
    manualSteps:
      "Please check your system's privacy or sound settings to allow Niuma to capture audio.",
  },
};

const getInstructionsForPlatform = (platform: string): Instructions => {
  if (platform.includes("mac")) {
    return osInstructions.macos;
  }
  if (platform.includes("win")) {
    return osInstructions.windows;
  }
  if (platform.includes("linux")) {
    return osInstructions.linux;
  }
  return osInstructions.undetermined;
};

export const SetupInstructions = ({
  setupRequired,
  handleSetup,
}: {
  setupRequired: boolean;
  handleSetup: () => void;
}) => {
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const platform = navigator.platform.toLowerCase();
  const instructions = getInstructionsForPlatform(platform);

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
          <p className="font-medium text-sm">Status:</p>
          <div className="flex flex-row gap-1.5 justify-center items-center">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTroubleshoot(!showTroubleshoot)}
          className="p-0"
        >
          Troubleshoot{" "}
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
              Note: {instructions.note}
            </p>
          )}
          <Button className="w-full" variant="outline" onClick={handleSetup}>
            Troubleshoot
          </Button>
        </div>
      ) : null}
    </div>
  );
};
