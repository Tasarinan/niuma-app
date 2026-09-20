/**
 * Pull follow-builders central feeds when /new starts.
 *
 * GitHub raw often times out in CN networks; try jsDelivr (and gitmirror) first.
 * The app injects the compacted JSON into the slash prompt so 采编 only remixes.
 */

export const FOLLOW_BUILDERS_REPO = "zarazhangrui/follow-builders";
export const FOLLOW_BUILDERS_BRANCH = "main";

export const FOLLOW_BUILDERS_FEEDS = [
  { id: "x" as const, path: "feed-x.json" },
  { id: "podcasts" as const, path: "feed-podcasts.json" },
  { id: "blogs" as const, path: "feed-blogs.json" },
];

export type DigestFeedId = (typeof FOLLOW_BUILDERS_FEEDS)[number]["id"];

export interface CompactDigestItem {
  kind: DigestFeedId;
  author?: string;
  handle?: string;
  title?: string;
  text: string;
  url: string;
  at?: string;
}

export interface DigestFeedPack {
  status: "ok" | "error";
  x: CompactDigestItem[];
  podcasts: CompactDigestItem[];
  blogs: CompactDigestItem[];
  errors: string[];
  generatedAt?: string;
}

export interface CompactCentralFeedsInput {
  x?: unknown;
  podcasts?: unknown;
  blogs?: unknown;
}

const X_TWEET_CAP = 32;
const PODCAST_CAP = 10;
const BLOG_CAP = 12;
const TEXT_CAP = 280;

export function isDigestCommand(name: string): boolean {
  return name.trim().toLowerCase() === "digest";
}

export function githubRawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${FOLLOW_BUILDERS_REPO}/${FOLLOW_BUILDERS_BRANCH}/${path}`;
}

export function jsdelivrUrl(path: string): string {
  return `https://cdn.jsdelivr.net/gh/${FOLLOW_BUILDERS_REPO}@${FOLLOW_BUILDERS_BRANCH}/${path}`;
}

export function gitmirrorUrl(path: string): string {
  return `https://raw.gitmirror.com/${FOLLOW_BUILDERS_REPO}/${FOLLOW_BUILDERS_BRANCH}/${path}`;
}

/** Mirror list for a GitHub raw URL. jsDelivr first — GitHub raw often times out. */
export function feedMirrorUrls(githubRaw: string): string[] {
  const parsed = parseGithubRaw(githubRaw);
  if (!parsed) return [githubRaw];
  const { owner, repo, branch, path } = parsed;
  return [
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
    `https://raw.gitmirror.com/${owner}/${repo}/${branch}/${path}`,
    githubRaw,
  ];
}

function parseGithubRaw(url: string): { owner: string; repo: string; branch: string; path: string } | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "raw.githubusercontent.com") return null;
    const parts = pathname.replace(/^\/+/, "").split("/");
    const [owner, repo, branch, ...rest] = parts;
    if (!owner || !repo || !branch || rest.length === 0) return null;
    return { owner, repo, branch, path: rest.join("/") };
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function sliceText(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > TEXT_CAP ? `${collapsed.slice(0, TEXT_CAP)}…` : collapsed;
}

function compactX(raw: unknown): CompactDigestItem[] {
  const root = asRecord(raw);
  const builders = (root?.x ?? raw) as unknown;
  if (!Array.isArray(builders)) return [];
  const items: CompactDigestItem[] = [];
  for (const builder of builders) {
    if (items.length >= X_TWEET_CAP) break;
    const person = asRecord(builder);
    if (!person) continue;
    const tweets = Array.isArray(person.tweets) ? person.tweets : [];
    for (const tweet of tweets) {
      if (items.length >= X_TWEET_CAP) break;
      const row = asRecord(tweet);
      if (!row) continue;
      const url = stringField(row, ["url", "link"]);
      const text = stringField(row, ["text", "content", "title"]);
      if (!url || !text) continue;
      items.push({
        kind: "x",
        author: stringField(person, ["name"]) || undefined,
        handle: stringField(person, ["handle", "username"]) || undefined,
        text: sliceText(text),
        url,
        at: stringField(row, ["createdAt", "publishedAt", "date"]) || undefined,
      });
    }
  }
  return items;
}

function compactListed(
  raw: unknown,
  kind: "podcasts" | "blogs",
  arrayKeys: string[],
  cap: number,
): CompactDigestItem[] {
  const root = asRecord(raw) ?? {};
  let list: unknown = raw;
  for (const key of arrayKeys) {
    if (Array.isArray(root[key])) {
      list = root[key];
      break;
    }
  }
  if (!Array.isArray(list)) return [];
  const items: CompactDigestItem[] = [];
  for (const entry of list) {
    if (items.length >= cap) break;
    const row = asRecord(entry);
    if (!row) continue;
    const url = stringField(row, ["url", "link", "permalink", "episodeUrl"]);
    const title = stringField(row, ["title", "episodeTitle", "name", "heading"]);
    const text = stringField(row, ["summary", "description", "text", "content", "snippet"]) || title;
    if (!url || !text) continue;
    items.push({
      kind,
      author: stringField(row, ["author", "show", "podcast", "name"]) || undefined,
      title: title || undefined,
      text: sliceText(text),
      url,
      at: stringField(row, ["publishedAt", "createdAt", "date", "pubDate"]) || undefined,
    });
  }
  return items;
}

export function compactCentralFeeds(input: CompactCentralFeedsInput): Pick<DigestFeedPack, "x" | "podcasts" | "blogs"> {
  return {
    x: compactX(input.x),
    podcasts: compactListed(input.podcasts, "podcasts", ["podcasts", "items", "episodes"], PODCAST_CAP),
    blogs: compactListed(input.blogs, "blogs", ["blogs", "items", "posts"], BLOG_CAP),
  };
}

function formatSection(title: string, items: CompactDigestItem[]): string[] {
  if (items.length === 0) return [`## ${title}`, "(无)"];
  const lines = [`## ${title}`];
  for (const item of items) {
    const who = item.handle ? `@${item.handle}` : item.author || item.title || "item";
    const heading = item.title && item.title !== item.text ? `${who} · ${item.title}` : who;
    lines.push(`- ${heading}: ${item.text}`);
    lines.push(`  ${item.url}`);
  }
  return lines;
}

export function formatDigestFeedContext(pack: DigestFeedPack): string {
  const rules = [
    "[中央 Feed · follow-builders]",
    `status: ${pack.status}`,
    pack.generatedAt ? `generatedAt: ${pack.generatedAt}` : "",
    "",
    "规则：",
    "- 应用已经拉取中央 feed。不要再运行 prepare-digest.mjs、run_skill、bash fetch 或 web_search 去补条目。",
    "- 只 remix 下列已有 URL 的条目；每条输出必须带原文链接。",
    "- 禁止发明条目或 URL。",
    "- 默认中文。",
    pack.status === "error" || (pack.x.length === 0 && pack.podcasts.length === 0 && pack.blogs.length === 0)
      ? "- feed 失败或为空时，向用户说明原因，不要编造简报。"
      : "",
  ].filter(Boolean);

  const body = [
    ...formatSection("X", pack.x),
    "",
    ...formatSection("播客", pack.podcasts),
    "",
    ...formatSection("博客", pack.blogs),
  ];

  const errors =
    pack.errors.length > 0 ? ["", "## 错误", ...pack.errors.map((err) => `- ${err}`)] : [];

  return [...rules, "", ...body, ...errors].join("\n");
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}`);
  }
  return response.json();
}

async function fetchJsonViaMirrors(fetchImpl: FetchLike, githubRaw: string): Promise<unknown> {
  const urls = feedMirrorUrls(githubRaw);
  const errors: string[] = [];
  for (const url of urls) {
    try {
      return await readJson(fetchImpl, url);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join("; "));
}

async function resolveFetch(fetchImpl?: FetchLike): Promise<FetchLike> {
  if (fetchImpl) return fetchImpl;
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    try {
      const { getProxyUrl } = await import("@/lib/providers/storage");
      const { invoke } = await import("@tauri-apps/api/core");
      const proxy = getProxyUrl();
      if (proxy) await invoke("set_proxy_url", { proxyUrl: proxy }).catch(() => undefined);
    } catch {
      // proxy is best-effort
    }
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch as unknown as FetchLike;
  }
  return globalThis.fetch.bind(globalThis);
}

export async function loadCentralFeeds(options?: { fetchImpl?: FetchLike }): Promise<DigestFeedPack> {
  const fetchImpl = await resolveFetch(options?.fetchImpl);
  const errors: string[] = [];
  const raw: CompactCentralFeedsInput = {};

  await Promise.all(
    FOLLOW_BUILDERS_FEEDS.map(async (feed) => {
      try {
        raw[feed.id] = await fetchJsonViaMirrors(fetchImpl, githubRawUrl(feed.path));
      } catch (err) {
        errors.push(`Could not fetch ${feed.id === "x" ? "tweet" : feed.id === "podcasts" ? "podcast" : "blog"} feed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  const compact = compactCentralFeeds(raw);
  const generatedAt =
    stringField(asRecord(raw.x) ?? {}, ["generatedAt"]) ||
    stringField(asRecord(raw.podcasts) ?? {}, ["generatedAt"]) ||
    stringField(asRecord(raw.blogs) ?? {}, ["generatedAt"]) ||
    undefined;
  const hasItems = compact.x.length + compact.podcasts.length + compact.blogs.length > 0;

  return {
    status: hasItems ? "ok" : "error",
    ...compact,
    errors,
    generatedAt,
  };
}
