import { Button } from "@/components";
import { LaptopMinimalIcon, Loader2, MousePointer2Icon } from "lucide-react";
import { UseCompletionReturn } from "@/types";
import { MAX_FILES } from "@/config";

export const Screenshot = ({
  screenshotConfiguration,
  attachedFiles,
  isLoading,
  captureScreenshot,
  isScreenshotLoading,
}: UseCompletionReturn) => {
  const captureMode = screenshotConfiguration.enabled
    ? "Screenshot"
    : "Selection";
  const processingMode = screenshotConfiguration.mode;

  return (
    <Button
      size="icon"
      className="cursor-pointer"
      title={`${captureMode} mode (${processingMode}) - ${attachedFiles.length}/${MAX_FILES} files`}
      onClick={captureScreenshot}
      disabled={
        attachedFiles.length >= MAX_FILES || isLoading || isScreenshotLoading
      }
    >
      {isScreenshotLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : screenshotConfiguration.enabled ? (
        <LaptopMinimalIcon className="h-4 w-4" />
      ) : (
        <MousePointer2Icon className="h-4 w-4" />
      )}
    </Button>
  );
};
