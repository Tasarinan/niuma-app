import { KeyboardIcon } from "lucide-react";
import { Card } from "@/components";

export const Warning = () => {
  return (
    <div className="border-t border-input/50 pt-3 space-y-3">
      {/* Keyboard Shortcuts Card */}
      <Card className="p-3 border">
        <div className="flex items-start gap-2">
          <KeyboardIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="w-full">
            <h4 className="font-medium text-xs mb-2">Keyboard Shortcuts</h4>
            <div className="space-y-1.5 text-xs">
              {/* Scrolling Shortcuts */}
              <div>
                <p className="font-medium mb-1.5">Navigation</p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Scroll Down</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                      ↓
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Scroll Up</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                      ↑
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Continuous Mode Shortcuts */}
              <div className="pt-2 border-t border-border/50">
                <p className="font-medium mb-1.5">Continuous Mode</p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Start Recording
                    </span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                        Space
                      </kbd>
                      <span className="text-muted-foreground">or</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                        Enter
                      </kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stop & Send</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                      Enter
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Ignore Recording
                    </span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="pt-3 border-t border-border/50">
                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <p>
                    <span className="font-medium text-foreground">
                      VAD Mode:
                    </span>{" "}
                    Automatically detects and captures speech using Voice
                    Activity Detection. Recording starts/stops automatically
                    based on speech detection.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Continuous Mode:
                    </span>{" "}
                    Manual recording mode where you control when to start and
                    stop. Record up to 3 minutes, then click "Stop & Send" for
                    transcription or "Ignore" to discard.
                  </p>
                  <p className="pt-1">
                    <span className="font-medium text-foreground">
                      Switch Modes:
                    </span>{" "}
                    Toggle between VAD and Continuous Mode in the "Audio
                    Detection Settings" section below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
