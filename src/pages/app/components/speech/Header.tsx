import { X } from "lucide-react";
import { Button } from "@/components";

type Props = {
  setupRequired: boolean;
  setIsPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resizeWindow: (expanded: boolean) => Promise<void>;
  capturing: boolean;
};

export const Header = ({
  setupRequired,
  setIsPopoverOpen,
  resizeWindow,
  capturing,
}: Props) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-b border-input/50 pb-3 flex justify-between items-start">
        <div>
          <h2 className="font-semibold text-sm">System Audio Capture</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {setupRequired
              ? "Setup required to capture system audio"
              : "Until and unless sound is detected from your speakers no api calls will be made"}
          </p>
        </div>
        {!capturing ? (
          <div className="">
            <Button
              size="icon"
              title="Close Settings"
              onClick={() => {
                setIsPopoverOpen(false);
                resizeWindow(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
