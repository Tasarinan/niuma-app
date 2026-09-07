/** Search and download public web images for the 配图师. */

export const MAX_WEB_IMAGE_BYTES = 8 * 1024 * 1024;
const SEARCH_UA =
  "niuma-app/1.0 (https://github.com/Tasarinan/niuma-app; image search for WeChat drafts)";

export type WebImageHit = {
  title: string;
  imageUrl: string;
  pageUrl: string;
  via: "unsplash" | "duckduckgo" | "wikimedia";
  license?: string;
};

function pluginFetch() {
  return import("@tauri-apps/plugin-http").then((mod) => mod.fetch);
}

export function isAllowedImageUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host === "::1" || host === "0.0.0.0") return false;
  if (/^(?:(\d{1,3})\.){3}\d{1,3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

export function extractDuckDuckGoVqd(html: string): string {
  const match =
    html.match(/\bvqd=(?:["']|&quot;)([^"'&<\s]+)/i) ??
    html.match(/\bvqd=([0-9-]+)/i);
  return match?.[1]?.trim() ?? "";
}

export function parseDuckDuckGoImageResults(payload: unknown, limit: number): WebImageHit[] {
  const root = payload as { results?: unknown };
  if (!Array.isArray(root.results)) return [];
  const hits: WebImageHit[] = [];
  for (const item of root.results) {
    if (hits.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const imageUrl = String(record.image ?? "").trim();
    if (!isAllowedImageUrl(imageUrl)) continue;
    hits.push({
      title: String(record.title ?? "").trim() || "untitled",
      imageUrl,
      pageUrl: String(record.url ?? "").trim(),
      via: "duckduckgo",
    });
  }
  return hits;
}

export function parseWikimediaImageResults(payload: unknown, limit: number): WebImageHit[] {
  const pages = (payload as { query?: { pages?: Record<string, unknown> } }).query?.pages;
  if (!pages || typeof pages !== "object") return [];
  const hits: WebImageHit[] = [];
  for (const page of Object.values(pages)) {
    if (hits.length >= limit) break;
    if (!page || typeof page !== "object") continue;
    const record = page as Record<string, unknown>;
    const info = Array.isArray(record.imageinfo) ? record.imageinfo[0] : null;
    if (!info || typeof info !== "object") continue;
    const image = info as Record<string, unknown>;
    const imageUrl = String(image.url ?? image.thumburl ?? "").trim();
    if (!isAllowedImageUrl(imageUrl)) continue;
    const meta = image.extmetadata as Record<string, { value?: unknown }> | undefined;
    const license = String(meta?.LicenseShortName?.value ?? "").trim();
    hits.push({
      title: String(record.title ?? "").replace(/^File:/i, "").trim() || "untitled",
      imageUrl,
      pageUrl: String(image.descriptionurl ?? "").trim(),
      via: "wikimedia",
      license: license || undefined,
    });
  }
  return hits;
}

export function unsplashAccessKeyFromEnv(env: Record<string, string>): string {
  return String(env.UNSPLASH_ACCESS_KEY ?? env.UNSPLASH_ACCESS_KEY_ID ?? "").trim();
}

function unsplashPageUrl(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "https://unsplash.com/?utm_source=niuma-app&utm_medium=referral";
  try {
    const url = new URL(trimmed);
    url.searchParams.set("utm_source", "niuma-app");
    url.searchParams.set("utm_medium", "referral");
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function parseUnsplashPhotoResults(payload: unknown, limit: number): WebImageHit[] {
  const root = payload as { results?: unknown };
  if (!Array.isArray(root.results)) return [];
  const hits: WebImageHit[] = [];
  for (const item of root.results) {
    if (hits.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const urls = (record.urls ?? {}) as Record<string, unknown>;
    const links = (record.links ?? {}) as Record<string, unknown>;
    const user = (record.user ?? {}) as Record<string, unknown>;
    const imageUrl = String(urls.regular ?? urls.full ?? urls.raw ?? urls.small ?? "").trim();
    if (!isAllowedImageUrl(imageUrl)) continue;
    const photographer = String(user.name ?? "").trim();
    hits.push({
      title:
        String(record.alt_description ?? record.description ?? photographer ?? "").trim() ||
        "Unsplash photo",
      imageUrl,
      pageUrl: unsplashPageUrl(String(links.html ?? "")),
      via: "unsplash",
      license: photographer ? `Unsplash License · Photo by ${photographer}` : "Unsplash License",
    });
  }
  return hits;
}

export function formatWebImageHits(hits: WebImageHit[]): string {
  if (hits.length === 0) return "(无图片搜索结果)";
  return hits
    .map((hit, index) => {
      const license = hit.license ? ` · ${hit.license}` : "";
      const page = hit.pageUrl ? `\n   page: ${hit.pageUrl}` : "";
      return `${index + 1}. ${hit.title}\n   image: ${hit.imageUrl}${page}\n   via: ${hit.via}${license}`;
    })
    .join("\n\n");
}

function looksLikeRasterImage(bytes: Uint8Array, contentType: string): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  return /^image\/(png|jpe?g|gif|webp|bmp)/i.test(contentType);
}

async function fetchText(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  const fetch = await pluginFetch();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": SEARCH_UA,
      Accept: "text/html,application/json,*/*",
      ...extraHeaders,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url: string, extraHeaders?: Record<string, string>): Promise<unknown> {
  const text = await fetchText(url, extraHeaders);
  return JSON.parse(text) as unknown;
}

function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function readUnsplashAccessKey(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
    if (!root) return "";
    const sep = root.includes("\\") ? "\\" : "/";
    const raw = await invoke<string>("read_text_file", { path: `${root}${sep}.env.local` }).catch(() => "");
    return unsplashAccessKeyFromEnv(parseDotEnv(raw));
  } catch {
    return "";
  }
}

async function searchUnsplashImages(query: string, limit: number): Promise<WebImageHit[]> {
  const key = await readUnsplashAccessKey();
  if (key) {
    const api = new URL("https://api.unsplash.com/search/photos");
    api.searchParams.set("query", query);
    api.searchParams.set("per_page", String(limit));
    api.searchParams.set("orientation", "landscape");
    const payload = await fetchJson(api.toString(), {
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
    });
    return parseUnsplashPhotoResults(payload, limit);
  }
  const napi = new URL("https://unsplash.com/napi/search/photos");
  napi.searchParams.set("query", query);
  napi.searchParams.set("per_page", String(limit));
  napi.searchParams.set("page", "1");
  const payload = await fetchJson(napi.toString());
  return parseUnsplashPhotoResults(payload, limit);
}

async function searchDuckDuckGoImages(query: string, limit: number): Promise<WebImageHit[]> {
  const home = new URL("https://duckduckgo.com/");
  home.searchParams.set("q", query);
  const html = await fetchText(home.toString());
  const vqd = extractDuckDuckGoVqd(html);
  if (!vqd) return [];
  const images = new URL("https://duckduckgo.com/i.js");
  images.searchParams.set("l", "us-en");
  images.searchParams.set("o", "json");
  images.searchParams.set("q", query);
  images.searchParams.set("vqd", vqd);
  images.searchParams.set("f", ",,,");
  const payload = await fetchJson(images.toString());
  return parseDuckDuckGoImageResults(payload, limit);
}

async function searchWikimediaImages(query: string, limit: number): Promise<WebImageHit[]> {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("origin", "*");
  api.searchParams.set("generator", "search");
  api.searchParams.set("gsrsearch", query);
  api.searchParams.set("gsrnamespace", "6");
  api.searchParams.set("gsrlimit", String(limit));
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url|mime|size|extmetadata");
  api.searchParams.set("iiurlwidth", "1600");
  const payload = await fetchJson(api.toString());
  return parseWikimediaImageResults(payload, limit);
}

export async function searchWebImages(query: string, maxResults = 8): Promise<WebImageHit[]> {
  const needle = query.trim();
  if (!needle) throw new Error("缺少搜图关键词");
  const limit = Math.max(1, Math.min(12, Math.floor(maxResults)));
  const seen = new Set<string>();
  const hits: WebImageHit[] = [];
  const sources = [
    () => searchUnsplashImages(needle, limit),
    () => searchWikimediaImages(needle, limit),
    () => searchDuckDuckGoImages(needle, limit),
  ];
  for (const source of sources) {
    if (hits.length >= limit) break;
    try {
      const batch = await source();
      for (const hit of batch) {
        if (hits.length >= limit) break;
        const key = hit.imageUrl.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(hit);
      }
    } catch {
      // Unsplash / Wikimedia / DuckDuckGo — keep going if one source is down.
    }
  }
  return hits;
}

export async function downloadWebImageBytes(imageUrl: string): Promise<Uint8Array> {
  if (!isAllowedImageUrl(imageUrl)) {
    throw new Error("只能下载 http(s) 公网图片，不能下内网或本地地址");
  }
  const fetch = await pluginFetch();
  const response = await fetch(imageUrl, {
    method: "GET",
    headers: {
      "User-Agent": SEARCH_UA,
      Accept: "image/png,image/jpeg,image/webp,image/gif,image/*;q=0.8,*/*;q=0.5",
    },
  });
  if (!response.ok) throw new Error(`下载图片失败: HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_WEB_IMAGE_BYTES) throw new Error("图片超过 8MB，换一张");
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > MAX_WEB_IMAGE_BYTES) throw new Error("图片超过 8MB，换一张");
  const contentType = response.headers.get("content-type") ?? "";
  if (!looksLikeRasterImage(buffer, contentType)) {
    throw new Error("地址不是 PNG/JPEG/WebP/GIF 图片");
  }
  return buffer;
}
