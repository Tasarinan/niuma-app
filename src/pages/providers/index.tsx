import { useState } from "react";
import { Cpu, Key, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiProvidersTab } from "./ai-configs/ApiProvidersTab";
import { ZeroTokenTab } from "./ai-configs/ZeroTokenTab";

type ProviderTab = "api" | "web";

const TABS: { id: ProviderTab; icon: React.ElementType; label: string }[] = [
  { id: "api",  icon: Key,   label: "API 提供商" },
  { id: "web",  icon: Globe, label: "网页零Token" },
];

export default function ProvidersPage() {
  const [tab, setTab] = useState<ProviderTab>("api");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/20">
      <div className="flex flex-shrink-0 items-center gap-0 border-b bg-background px-4">
        <div className="flex items-center gap-2 pr-4 py-3 border-r mr-2">
          <Cpu className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">AI 提供商</span>
        </div>
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4 max-w-2xl mx-auto">
          {tab === "api" && <ApiProvidersTab />}
          {tab === "web" && <ZeroTokenTab />}
        </div>
      </div>
    </div>
  );
}
