/** Refuse a manuscript save when disk moved after the editor last read it. */

export function normalizeArticleText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function isMissingArticleFile(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|cannot find|no such file|os error 2|os error 3|找不到|不存在/i.test(message);
}

export function diskWriteDecision(input: {
  fileExists: boolean;
  diskContent: string;
  baselineContent: string;
  adoptDisk?: boolean;
}): "write" | "conflict" {
  if (!input.fileExists || input.adoptDisk) return "write";
  if (normalizeArticleText(input.diskContent) === normalizeArticleText(input.baselineContent)) {
    return "write";
  }
  return "conflict";
}
