/**
 * Route the Pi/OpenAI SDK's HTTP traffic to the model provider through Tauri's
 * `plugin-http` fetch.
 *
 * pi-ai builds its HTTP client on the WebView's global `fetch`. Inside a Tauri
 * WebView a direct `fetch` to an external provider (`api.openai.com`, …) is
 * cross-origin and gets blocked by the WebView's CORS enforcement, so the SDK
 * only ever sees a generic "Connection error.".
 *
 * pi-ai exposes no hook to inject a custom `fetch`, so we install a one-time
 * global `fetch` shim that delegates requests to *allow-listed provider hosts*
 * to the Rust-side `plugin-http` fetch (which bypasses CORS and supports
 * streaming). Every other request keeps using the original WebView `fetch`, so
 * the rest of the app is unaffected. Hosts are registered per agent run.
 */

import { invoke } from "@tauri-apps/api/core";
import { getProxyUrl } from "@/lib/providers/storage";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/** Provider hosts whose traffic should be routed through plugin-http. */
const allowedHosts = new Set<string>();

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function shouldRoute(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return allowedHosts.has(parsed.host);
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Register `host` for plugin-http routing and idempotently install the fetch
 * shim. No-op outside Tauri. Safe to call before every agent run.
 */
export async function ensureAgentFetch(host: string): Promise<void> {
  if (host) allowedHosts.add(host);
  if (installed || !isTauri()) return;
  // Apply stored proxy before installing the fetch shim
  const storedProxy = getProxyUrl();
  if (storedProxy) {
    await invoke("set_proxy_url", { proxyUrl: storedProxy }).catch(console.warn);
  }
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  installed = true;

  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (shouldRoute(url)) {
      return (tauriFetch as unknown as typeof fetch)(input, init);
    }
    return original(input, init);
  }) as typeof fetch;
}
