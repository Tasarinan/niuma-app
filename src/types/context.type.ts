import { Dispatch, SetStateAction } from "react";
import { ScreenshotConfig, TYPE_PROVIDER, UserIdentity } from "@/types";
import { CursorType, CustomizableState } from "@/lib/storage";

export type IContextType = {
  allAiProviders: TYPE_PROVIDER[];
  customAiProviders: TYPE_PROVIDER[];
  selectedAIProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  onSetSelectedAIProvider: ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  allSttProviders: TYPE_PROVIDER[];
  customSttProviders: TYPE_PROVIDER[];
  selectedSttProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  onSetSelectedSttProvider: ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  screenshotConfiguration: ScreenshotConfig;
  setScreenshotConfiguration: React.Dispatch<
    React.SetStateAction<ScreenshotConfig>
  >;
  customizable: CustomizableState;
  toggleAppIconVisibility: (isVisible: boolean) => Promise<void>;
  toggleAlwaysOnTop: (isEnabled: boolean) => Promise<void>;
  toggleAutostart: (isEnabled: boolean) => Promise<void>;
  loadData: () => void;
  NiumaApiEnabled: boolean;
  setNiumaApiEnabled: (enabled: boolean) => void;
  hasActiveLicense: boolean;
  setHasActiveLicense: Dispatch<SetStateAction<boolean>>;
  getActiveLicenseStatus: () => Promise<void>;
  selectedAudioDevices: {
    input: string;
    output: string;
  };
  setSelectedAudioDevices: Dispatch<
    SetStateAction<{
      input: string;
      output: string;
    }>
  >;
  setCursorType: (type: CursorType) => void;
  // STT Language setting
  sttLanguage: string;
  setSttLanguage: (language: string) => void;

  // STT Translation settings
  sttTranslationEnabled: boolean;
  setSttTranslationEnabled: (enabled: boolean) => void;
  sttTranslationLanguage: string;
  setSttTranslationLanguage: (language: string) => void;

  // Response language setting (for AI responses)
  responseLanguage: string;
  setResponseLanguage: (language: string) => void;

  // User Identity settings
  userIdentity: UserIdentity | null;
  setUserIdentity: (identity: UserIdentity) => Promise<void>;
};
