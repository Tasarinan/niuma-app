import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCcw } from "lucide-react";
import {
  getContextMemorySettings,
  setContextMemorySettings,
  invalidateContextCache,
} from "@/lib/functions/context-builder";
import { runCompactionIfNeeded } from "@/lib/functions/knowledge-compactor";
import { deleteAllMeetingContextData } from "@/lib/database";

interface ContextSettingsProps {
  onSettingsChange?: () => void;
}

export const ContextSettings = ({ onSettingsChange }: ContextSettingsProps) => {
  const [enabled, setEnabled] = useState(true);
  const [maxTokens, setMaxTokens] = useState(1500);
  const [days, setDays] = useState(30);
  const [isCompacting, setIsCompacting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const settings = getContextMemorySettings();
    setEnabled(settings.enabled);
    setMaxTokens(settings.maxTokens);
    setDays(settings.days);
  }, []);

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    setContextMemorySettings({ enabled: checked });
    onSettingsChange?.();
  };

  const handleMaxTokensChange = (value: number[]) => {
    const newValue = value[0];
    setMaxTokens(newValue);
    setContextMemorySettings({ maxTokens: newValue });
    onSettingsChange?.();
  };

  const handleDaysChange = (value: number[]) => {
    const newValue = value[0];
    setDays(newValue);
    setContextMemorySettings({ days: newValue });
    onSettingsChange?.();
  };

  const handleCompactNow = async () => {
    setIsCompacting(true);
    try {
      await runCompactionIfNeeded();
      invalidateContextCache();
      onSettingsChange?.();
    } catch (error) {
      console.error("Compaction failed:", error);
    } finally {
      setIsCompacting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete all context memory data? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllMeetingContextData();
      invalidateContextCache();
      onSettingsChange?.();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Context Memory Settings</CardTitle>
        <CardDescription>
          Configure how context is collected and injected into AI prompts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="context-enabled">Enable Context Memory</Label>
            <p className="text-xs text-muted-foreground">
              Automatically inject relevant context into AI prompts
            </p>
          </div>
          <Switch
            id="context-enabled"
            checked={enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        {/* Max Tokens Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Max Context Tokens</Label>
            <span className="text-sm text-muted-foreground">{maxTokens}</span>
          </div>
          <Slider
            value={[maxTokens]}
            onValueChange={handleMaxTokensChange}
            min={500}
            max={3000}
            step={100}
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            Maximum tokens to include in context injection (500-3000)
          </p>
        </div>

        {/* Days Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Context Window (Days)</Label>
            <span className="text-sm text-muted-foreground">{days} days</span>
          </div>
          <Slider
            value={[days]}
            onValueChange={handleDaysChange}
            min={7}
            max={90}
            step={1}
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            Include recent summaries from the last {days} days
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCompactNow}
            disabled={isCompacting || !enabled}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isCompacting ? "animate-spin" : ""}`} />
            {isCompacting ? "Compacting..." : "Compact Now"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteAll}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? "Deleting..." : "Delete All Data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
