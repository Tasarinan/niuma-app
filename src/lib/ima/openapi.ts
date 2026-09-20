/**
 * IMA OpenAPI client for the desktop app.
 *
 * Official auth is HTTP headers (not sandbox env):
 *   ima-openapi-clientid / ima-openapi-apikey
 * Sandbox env_clear + KEY-stripping made ima_api.cjs / curl 认证失败.
 * Credentials stay in .env.local and are never formatted into chat.
 */

export const IMA_API_BASE = "https://ima.qq.com";

export interface ImaCredentials {
  clientId: string;
  apiKey: string;
}

export interface ImaTopicItem {
  title: string;
  excerpt: string;
  url: string;
}

export interface ImaTopicPack {
  status: "ok" | "error";
  query: string;
  items: ImaTopicItem[];
  errors: string[];
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function isTopicCommand(name: string): boolean {
  return name.trim().toLowerCase() === "topic";
}

export function parseImaCredentials(env: Record<string, string>): ImaCredentials | null {
  const clientId = String(env.IMA_CLIENT_ID ?? env.IMA_OPENAPI_CLIENTID ?? "").trim();
  const apiKey = String(env.IMA_API_KEY ?? env.IMA_OPENAPI_APIKEY ?? "").trim();
  if (!clientId || !apiKey) return null;
  return { clientId, apiKey };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstArray(data: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.map(asRecord);
  }
  return [];
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

export async function imaOpenApiPost(
  apiPath: string,
  body: Record<string, unknown>,
  options: { credentials: ImaCredentials; fetchImpl?: FetchLike },
): Promise<Record<string, unknown>> {
  const fetchImpl = await resolveFetch(options.fetchImpl);
  const path = apiPath.replace(/^\/+/, "");
  const response = await fetchImpl(`${IMA_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      "ima-openapi-clientid": options.credentials.clientId,
      "ima-openapi-apikey": options.credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = asRecord(JSON.parse(raw));
  } catch {
    parsed = {};
  }
  const msg = String(parsed.msg ?? parsed.message ?? "").trim();
  if (!response.ok) {
    throw new Error(msg || `IMA HTTP ${response.status}`);
  }
  if (typeof parsed.code === "number" && parsed.code !== 0) {
    throw new Error(msg || "IMA 返回错误");
  }
  return asRecord(parsed.data ?? parsed);
}

export function formatImaTopicContext(pack: ImaTopicPack): string {
  const lines = [
    "[IMA 文章资产 · /new]",
    `status: ${pack.status}`,
    `query: ${pack.query}`,
    "",
    "规则：",
    "- 应用已用工作区 `.env.local` 完成 IMA 认证并搜索。不要再 curl ima.qq.com、不要跑 ima_api.cjs、不要用 bash 带密钥。",
    "- 综合下列 IMA 条目、蜜蜂简报和用户输入，只定一个主题。",
    pack.status === "error" || pack.items.length === 0
      ? "- IMA 失败或为空时说明原因，仍可只根据简报/用户输入选题，不要编造 IMA 里没有的文章。"
      : "",
    "",
    "## IMA 条目",
  ].filter(Boolean);

  if (pack.items.length === 0) {
    lines.push("(无)");
  } else {
    for (const item of pack.items) {
      lines.push(`- 《${item.title}》${item.excerpt ? `：${item.excerpt}` : ""}`);
      if (item.url) lines.push(`  ${item.url}`);
    }
  }
  if (pack.errors.length > 0) {
    lines.push("", "## 错误", ...pack.errors.map((err) => `- ${err}`));
  }
  return lines.join("\n");
}

export function compactImaItems(data: Record<string, unknown>): ImaTopicItem[] {
  const items = firstArray(data, ["info_list", "infoList", "knowledge_list", "list"]);
  return items.slice(0, 8).map((item) => ({
    title: String(item.title ?? item.name ?? "未命名"),
    excerpt: String(item.summary ?? item.digest ?? item.content ?? item.snippet ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280),
    url: String(item.url ?? item.link ?? ""),
  }));
}

async function readEnvLocal(): Promise<Record<string, string>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const { parseDotenv } = await import("@/lib/wechat/accounts");
    const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
    if (!root) return {};
    const sep = root.includes("\\") ? "\\" : "/";
    const raw = await invoke<string>("read_text_file", { path: `${root}${sep}.env.local` }).catch(() => "");
    return raw ? parseDotenv(raw) : {};
  } catch {
    return {};
  }
}

export async function loadImaTopicPack(options: {
  query: string;
  kbId?: string;
  env?: Record<string, string>;
  fetchImpl?: FetchLike;
}): Promise<ImaTopicPack> {
  const query = options.query.trim() || "选题";
  const env = options.env ?? (await readEnvLocal());
  const credentials = parseImaCredentials(env);
  if (!credentials) {
    return {
      status: "error",
      query,
      items: [],
      errors: ["未在工作区 .env.local 找到 IMA_CLIENT_ID / IMA_API_KEY。请在本地文件填写，不要把密钥发到聊天里。"],
    };
  }

  let kbId = options.kbId;
  if (!kbId) {
    try {
      const { getImaKbConfig } = await import("@/lib/storage/ima.storage");
      kbId = getImaKbConfig().kbId;
    } catch {
      kbId = "";
    }
  }

  try {
    if (!kbId) {
      const bases = await imaOpenApiPost(
        "openapi/wiki/v1/search_knowledge_base",
        { query: "", cursor: "", limit: 10 },
        { credentials, fetchImpl: options.fetchImpl },
      );
      const list = firstArray(bases, ["info_list", "infoList", "list"]);
      kbId = String(list[0]?.kb_id ?? list[0]?.id ?? "");
    }
    if (!kbId) {
      return {
        status: "error",
        query,
        items: [],
        errors: ["IMA 知识库未配置（kbId 为空）。请在文章编辑器右侧面板选择「文章资产」。"],
      };
    }
    const data = await imaOpenApiPost(
      "openapi/wiki/v1/search_knowledge",
      { query, cursor: "", knowledge_base_id: kbId },
      { credentials, fetchImpl: options.fetchImpl },
    );
    const items = compactImaItems(data);
    return {
      status: items.length > 0 ? "ok" : "error",
      query,
      items,
      errors: items.length > 0 ? [] : [`IMA 中未找到与「${query}」相关的内容`],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      query,
      items: [],
      errors: [message.includes("认证") ? `${message}。请核对 .env.local 里的 IMA_CLIENT_ID / IMA_API_KEY，不要把密钥发到聊天里。` : message],
    };
  }
}

export async function runImaOpenApi(
  apiPath: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const credentials = parseImaCredentials(await readEnvLocal());
  if (!credentials) {
    throw new Error("未在工作区 .env.local 找到 IMA_CLIENT_ID / IMA_API_KEY");
  }
  return imaOpenApiPost(apiPath, body, { credentials });
}
