import { useState, useEffect } from "react";
import { Header } from "@/components";
import { useTranslation } from "react-i18next";
import { getResponseSettings, updateResponseLength } from "@/lib/storage/response-settings.storage";
import {
  RESPONSE_LENGTH_PRESETS,
  type ResponseLengthPreset,
} from "@/lib/response-settings.constants";
import { cn } from "@/lib/utils";

export const ResponseLength = () => {
  const { t } = useTranslation("pages");
  const [preset, setPreset] = useState<ResponseLengthPreset>("standard");

  useEffect(() => {
    setPreset(getResponseSettings().responseLengthPreset);
  }, []);

  const handleSelect = (p: ResponseLengthPreset) => {
    const def = RESPONSE_LENGTH_PRESETS[p];
    setPreset(p);
    updateResponseLength(p, def.tokens);
  };

  return (
    <div className="space-y-4">
      <Header
        title={t("responsesPage.responseLength.title", { defaultValue: "回复长度" })}
        description={t("responsesPage.responseLength.description", {
          defaultValue: "控制 AI 每次回复允许输出的最大 token 数，影响所有频道中的智能体。",
        })}
        isMainTitle
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(RESPONSE_LENGTH_PRESETS) as [ResponseLengthPreset, typeof RESPONSE_LENGTH_PRESETS[ResponseLengthPreset]][]).map(
          ([key, def]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all",
                preset === key
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-muted-foreground/40"
              )}
            >
              <span className="text-sm font-semibold">{def.label}</span>
              <span className="text-[10px] text-muted-foreground">{def.tokens.toLocaleString()} tokens</span>
              <span className="text-[10px] text-muted-foreground/70 mt-0.5">{def.desc}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};
