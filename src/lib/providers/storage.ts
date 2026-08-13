/**
 * Provider config storage — direct key/model/url registration, no cURL.
 *
 * Persists to localStorage under a single JSON key.
 * Each entry maps providerId → { apiKey, model, baseUrlOverride? }.
 */

import type { ProviderCredential } from "./registry";

const STORAGE_KEY = "niuma_provider_configs_v1";

export interface StoredProviderConfig extends ProviderCredential {
  providerId: string;
}

function load(): Record<string, StoredProviderConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(configs: Record<string, StoredProviderConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    console.warn("[providerStorage] Failed to persist provider configs");
  }
}

/** Save (or overwrite) a provider credential. */
export function saveProviderConfig(config: StoredProviderConfig): void {
  const all = load();
  all[config.providerId] = config;
  save(all);
}

/** Retrieve a single provider's stored config, or undefined. */
export function getProviderConfig(
  providerId: string
): StoredProviderConfig | undefined {
  return load()[providerId];
}

/** All stored configs (one per providerId). */
export function getAllProviderConfigs(): StoredProviderConfig[] {
  return Object.values(load());
}

/** Remove a provider config (e.g. when user removes a custom provider). */
export function removeProviderConfig(providerId: string): void {
  const all = load();
  delete all[providerId];
  save(all);
}

/** The provider currently selected as "active" for the agent. */
const ACTIVE_KEY = "niuma_active_provider_v1";
/** Separate keys so API and web providers each track their own last selection. */
const ACTIVE_API_KEY = "niuma_active_api_provider_v1";
const ACTIVE_WEB_KEY = "niuma_active_web_provider_v1";

export interface ActiveProvider {
  providerId: string;
  model: string;
}

export function getActiveProvider(): ActiveProvider | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveProvider(active: ActiveProvider): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  } catch {
    console.warn("[providerStorage] Failed to persist active provider");
  }
}

/** Last saved API (non-web) provider — used by agents. */
export function getActiveApiProvider(): ActiveProvider | null {
  try {
    const raw = localStorage.getItem(ACTIVE_API_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveApiProvider(active: ActiveProvider): void {
  try {
    localStorage.setItem(ACTIVE_API_KEY, JSON.stringify(active));
  } catch {
    console.warn("[providerStorage] Failed to persist active API provider");
  }
}

/** Last activated web (zero-token) provider — used by toolbar inline response. */
export function getActiveWebProvider(): ActiveProvider | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WEB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveWebProvider(active: ActiveProvider): void {
  try {
    localStorage.setItem(ACTIVE_WEB_KEY, JSON.stringify(active));
  } catch {
    console.warn("[providerStorage] Failed to persist active web provider");
  }
}

// ─── Proxy settings ───────────────────────────────────────────────────────────
const PROXY_KEY = "niuma_proxy_url_v1";

export function getProxyUrl(): string {
  try {
    return localStorage.getItem(PROXY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setProxyUrl(url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(PROXY_KEY, url.trim());
    } else {
      localStorage.removeItem(PROXY_KEY);
    }
  } catch {
    console.warn("[providerStorage] Failed to persist proxy URL");
  }
}
