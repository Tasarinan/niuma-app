export type ProviderModelKind = "text" | "image" | "video";

export function classifyModelKind(id: string): ProviderModelKind {
  const name = id.trim().toLowerCase();
  if (!name) return "text";
  if (
    name.includes("video") ||
    name.includes("sora") ||
    name.includes("kling") ||
    name.includes("runway") ||
    name.includes("luma")
  ) {
    return "video";
  }
  if (
    name.includes("image") ||
    name.includes("dall-e") ||
    name.includes("dalle") ||
    name.includes("gpt-image") ||
    name.includes("imagen") ||
    name.includes("flux") ||
    name.includes("stable-diffusion") ||
    name.includes("sdxl")
  ) {
    return "image";
  }
  return "text";
}

export function uniqueModelIds(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const id = raw.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function partitionModels(ids: string[]): Record<ProviderModelKind, string[]> {
  const text: string[] = [];
  const image: string[] = [];
  const video: string[] = [];
  for (const id of ids) {
    const kind = classifyModelKind(id);
    if (kind === "image") image.push(id);
    else if (kind === "video") video.push(id);
    else text.push(id);
  }
  return { text, image, video };
}

export function ensureSelectedModel(list: string[], selected: string): string[] {
  const value = selected.trim();
  if (!value || list.includes(value)) return list;
  return [value, ...list];
}
