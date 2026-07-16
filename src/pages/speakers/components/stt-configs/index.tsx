import { Header } from "@/components";
import { UseSettingsReturn } from "@/types";
import { useTranslation } from "react-i18next";
import { Providers } from "./Providers";

export const STTProviders = (settings: UseSettingsReturn) => {
  const { t } = useTranslation("pages");
  return (
    <div id="stt-providers" className="space-y-3">
      <Header
        title={t("speechRecognitionPage.providersTitle")}
        description={t("speechRecognitionPage.providersDesc")}
        isMainTitle
      />

      {/* Providers Selection */}
      <Providers {...settings} />
    </div>
  );
};
