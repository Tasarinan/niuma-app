import { STORAGE_KEYS } from "@/config";
import {
  DEFAULT_AUTO_SCROLL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_RESPONSE_LENGTH,
  type ResponseLengthPreset,
} from "../response-settings.constants";

export interface ResponseSettings {
  autoScroll: boolean;
  maxTokens: number;
  responseLengthPreset: ResponseLengthPreset;
}

export const DEFAULT_RESPONSE_SETTINGS: ResponseSettings = {
  autoScroll: DEFAULT_AUTO_SCROLL,
  maxTokens: DEFAULT_MAX_TOKENS,
  responseLengthPreset: DEFAULT_RESPONSE_LENGTH,
};

export const getResponseSettings = (): ResponseSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RESPONSE_SETTINGS);
    if (!stored) return DEFAULT_RESPONSE_SETTINGS;
    const p = JSON.parse(stored) as Partial<ResponseSettings>;
    return {
      autoScroll: p.autoScroll ?? DEFAULT_AUTO_SCROLL,
      maxTokens: p.maxTokens ?? DEFAULT_MAX_TOKENS,
      responseLengthPreset: p.responseLengthPreset ?? DEFAULT_RESPONSE_LENGTH,
    };
  } catch {
    return DEFAULT_RESPONSE_SETTINGS;
  }
};

export const setResponseSettings = (settings: ResponseSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.RESPONSE_SETTINGS, JSON.stringify(settings));
  } catch { }
};

export const updateAutoScroll = (autoScroll: boolean): ResponseSettings => {
  const next = { ...getResponseSettings(), autoScroll };
  setResponseSettings(next);
  return next;
};

export const updateResponseLength = (preset: ResponseLengthPreset, tokens: number): ResponseSettings => {
  const next = { ...getResponseSettings(), responseLengthPreset: preset, maxTokens: tokens };
  setResponseSettings(next);
  return next;
};
