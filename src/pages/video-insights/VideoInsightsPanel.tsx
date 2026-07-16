import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Badge,
  Progress,
  Switch,
  Label,
  Card,
  CardContent,
} from "@/components";
import { UploadIcon, PlayIcon, SquareIcon } from "lucide-react";
import { useVideoInsights } from "@/hooks";

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * VideoInsightsPanel - the reusable core of the Video Insights feature
 * (select a local video, transcribe it, extract AI key points).
 * Used both by the standalone /video-insights page and embedded in a Dialog
 * from the Meeting Channel's control bar.
 */
export function VideoInsightsPanel() {
  const { t } = useTranslation("pages");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    videoRef,
    videoUrl,
    videoFileName,
    stage,
    progress,
    keyPoints,
    error,
    onlyPlayKeyPoints,
    setOnlyPlayKeyPoints,
    loadVideo,
    analyze,
    stopAnalysis,
    jumpToKeyPoint,
  } = useVideoInsights();

  const isBusy = stage === "transcribing" || stage === "extracting";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadVideo(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {!videoUrl ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-secondary/40 py-12 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <UploadIcon className="size-6" />
          {t("videoInsightsPage.selectVideo")}
        </button>
      ) : (
        <div className="space-y-3">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full rounded-xl border border-secondary/30 bg-black"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm text-muted-foreground">{videoFileName}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {t("videoInsightsPage.chooseAnother")}
              </Button>
              {isBusy ? (
                <Button variant="destructive" size="sm" className="gap-1" onClick={stopAnalysis}>
                  <SquareIcon className="size-3.5" />
                  {t("videoInsightsPage.stop")}
                </Button>
              ) : (
                <Button size="sm" className="gap-1" onClick={analyze}>
                  <PlayIcon className="size-3.5" />
                  {t("videoInsightsPage.analyze")}
                </Button>
              )}
            </div>
          </div>

          {isBusy && (
            <div className="space-y-1">
              <Progress value={progress * 100} />
              <p className="text-xs text-muted-foreground">
                {stage === "transcribing"
                  ? t("videoInsightsPage.transcribing")
                  : t("videoInsightsPage.extracting")}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {keyPoints.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-secondary/30 px-3 py-2">
              <Label htmlFor="only-key-points" className="text-sm">
                {t("videoInsightsPage.onlyPlayKeyPoints")}
              </Label>
              <Switch
                id="only-key-points"
                checked={onlyPlayKeyPoints}
                onCheckedChange={setOnlyPlayKeyPoints}
              />
            </div>
          )}

          {keyPoints.length > 0 && (
            <Card>
              <CardContent className="space-y-2">
                {keyPoints.map((kp) => (
                  <button
                    key={kp.id}
                    onClick={() => jumpToKeyPoint(kp)}
                    className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium">{kp.title}</span>
                      <Badge variant="secondary">
                        {formatTimestamp(kp.start)} - {formatTimestamp(kp.end)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{kp.summary}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
