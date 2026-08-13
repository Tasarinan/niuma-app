export const DEFAULT_AUTO_SCROLL = true;

export type ResponseLengthPreset = "short" | "standard" | "long" | "full";

export const RESPONSE_LENGTH_PRESETS: Record<ResponseLengthPreset, { label: string; tokens: number; desc: string }> = {
  short:    { label: "简短",   tokens: 800,  desc: "适合快速回答、单句摘要" },
  standard: { label: "标准",   tokens: 2000, desc: "大多数场景的默认长度" },
  long:     { label: "详细",   tokens: 4096, desc: "深度分析、长文写作" },
  full:     { label: "完整",   tokens: 8192, desc: "最长输出，不限制内容" },
};

export const DEFAULT_RESPONSE_LENGTH: ResponseLengthPreset = "standard";
export const DEFAULT_MAX_TOKENS = RESPONSE_LENGTH_PRESETS[DEFAULT_RESPONSE_LENGTH].tokens;

