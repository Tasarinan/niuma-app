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
import {
  getContextMemorySettings,
  setContextMemorySettings,
} from "@/lib/functions/context-builder";

export const ContextSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [maxTokens, setMaxTokens] = useState(1500);

  useEffect(() => {
    const s = getContextMemorySettings();
    setEnabled(s.enabled);
    setMaxTokens(s.maxTokens);
  }, []);

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    setContextMemorySettings({ enabled: checked });
  };

  const handleMaxTokensChange = (value: number[]) => {
    const v = value[0];
    setMaxTokens(v);
    setContextMemorySettings({ maxTokens: v });
  };

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">记忆注入设置</CardTitle>
        <CardDescription>
          控制是否将团队记忆（MEMORY.md）注入到智能体的系统提示词，以及允许智能体使用 <code className="text-xs">memory</code> 工具读写持久记忆。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mem-enabled">启用团队记忆</Label>
            <p className="text-xs text-muted-foreground">
              开启后，智能体可以读取过工作中保存的记忆，并在对话中主动将重要信息写入记忆。
            </p>
          </div>
          <Switch
            id="mem-enabled"
            checked={enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        {/* Injection size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>注入上限（Tokens）</Label>
            <span className="text-sm text-muted-foreground">{maxTokens}</span>
          </div>
          <Slider
            value={[maxTokens]}
            onValueChange={handleMaxTokensChange}
            min={500}
            max={4000}
            step={100}
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            MEMORY.md 索引注入系统提示词的最大内容量（500–4000 tokens）。越大记忆越详细，但会占用更多上下文窗口。
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
