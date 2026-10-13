/** WeChat draft title: UTF-8 bytes vs errcode 45028, not just 25 characters. */

export const WECHAT_TITLE_MAX_BYTES = 96;
export const WECHAT_TITLE_MAX_CHARS = 64;
export const WECHAT_TITLE_LIMIT_ERRCODE = 45028;

const PUNCT_STRIP = /[ ，,：:；;、]+$/u;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function trimTitleToWechatLimit(
  title: string,
  maxBytes: number = WECHAT_TITLE_MAX_BYTES,
): string {
  if (utf8ByteLength(title) <= maxBytes) return title;
  const encoder = new TextEncoder();
  let current = 0;
  let out = "";
  for (const ch of title) {
    const size = encoder.encode(ch).length;
    if (current + size > maxBytes) break;
    out += ch;
    current += size;
  }
  const trimmed = out.replace(PUNCT_STRIP, "");
  return trimmed || title.slice(0, 1);
}

export function describeWechatTitle(title: string): {
  chars: number;
  utf8Bytes: number;
  overBytes: boolean;
  overChars: boolean;
} {
  const chars = [...title].length;
  const utf8Bytes = utf8ByteLength(title);
  return {
    chars,
    utf8Bytes,
    overBytes: utf8Bytes > WECHAT_TITLE_MAX_BYTES,
    overChars: chars > WECHAT_TITLE_MAX_CHARS,
  };
}
