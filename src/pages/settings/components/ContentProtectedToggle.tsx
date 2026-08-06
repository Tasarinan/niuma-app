import { Switch, Label, Header } from "@/components";
import { useApp } from "@/store";

export const ContentProtectedToggle = ({ className }: { className?: string }) => {
  const { customizable, toggleContentProtected } = useApp();
  const isEnabled = customizable.contentProtected?.isEnabled ?? false;

  return (
    <div id="content-protected" className={`space-y-2 ${className ?? ""}`}>
      <Header
        title="防截屏保护"
        description="开启后，截图工具和录屏软件将无法捕获会话窗口的内容（显示为黑屏）。"
        isMainTitle
      />
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">
            {isEnabled ? "已开启保护" : "已关闭保护"}
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {isEnabled
              ? "截图/录屏工具无法捕获本应用窗口内容"
              : "允许截图工具正常捕获本应用窗口内容"}
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => toggleContentProtected(checked)}
          aria-label={isEnabled ? "关闭防截屏保护" : "开启防截屏保护"}
        />
      </div>
    </div>
  );
};
