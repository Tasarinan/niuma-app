/**
 * useProvider — React hook for managing the active provider selection.
 *
 * Reads/writes the direct-registration provider store (no cURL).
 * Exposes a resolveConnection() helper ready to pass into createAgentRuntime.
 */

import { useState, useCallback } from "react";
import {
  getAllProviders,
  getProvider,
  resolveConnection,
  registerCustomProvider,
  unregisterCustomProvider,
  type ProviderDef,
  type ProviderCredential,
} from "@/lib/providers/registry";
import {
  getActiveProvider,
  setActiveProvider,
  saveProviderConfig,
  getProviderConfig,
  getAllProviderConfigs,
  removeProviderConfig,
  type ActiveProvider,
  type StoredProviderConfig,
} from "@/lib/providers/storage";
import type { ProviderConnection } from "@/lib/agent/connection";

export interface UseProviderReturn {
  /** All known providers (built-ins + custom). */
  providers: ProviderDef[];
  /** Currently selected provider + model. */
  active: ActiveProvider | null;
  /** Select a provider + model as active. */
  selectProvider: (providerId: string, model: string) => void;
  /** Save credential for a provider (apiKey + optional baseUrlOverride). */
  saveCredential: (
    providerId: string,
    cred: Pick<ProviderCredential, "apiKey" | "baseUrlOverride">
  ) => void;
  /** Get stored credential for a provider. */
  getCredential: (providerId: string) => StoredProviderConfig | undefined;
  /** All stored credentials. */
  allCredentials: StoredProviderConfig[];
  /**
   * Register a custom provider (e.g. self-hosted endpoint).
   * Persists the credential automatically.
   */
  addCustomProvider: (
    def: Omit<ProviderDef, "type"> & { type?: ProviderDef["type"] },
    cred: ProviderCredential
  ) => void;
  /** Remove a custom provider and its stored credential. */
  removeCustomProvider: (id: string) => void;
  /**
   * Resolve the currently active provider into a ProviderConnection.
   * Returns null and sets error if resolution fails.
   */
  resolveActive: () => ProviderConnection | null;
  /** Last resolution error message, if any. */
  resolveError: string | null;
}

export function useProvider(): UseProviderReturn {
  const [providers, setProviders] = useState<ProviderDef[]>(getAllProviders);
  const [active, setActive] = useState<ActiveProvider | null>(getActiveProvider);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const refreshProviders = useCallback(() => {
    setProviders(getAllProviders());
  }, []);

  const selectProvider = useCallback((providerId: string, model: string) => {
    const next: ActiveProvider = { providerId, model };
    setActiveProvider(next);
    setActive(next);
    setResolveError(null);
  }, []);

  const saveCredential = useCallback(
    (
      providerId: string,
      cred: Pick<ProviderCredential, "apiKey" | "baseUrlOverride">
    ) => {
      const existing = getProviderConfig(providerId);
      saveProviderConfig({
        providerId,
        apiKey: cred.apiKey,
        model: existing?.model ?? "",
        baseUrlOverride: cred.baseUrlOverride,
      });
    },
    []
  );

  const addCustomProvider = useCallback(
    (
      def: Omit<ProviderDef, "type"> & { type?: ProviderDef["type"] },
      cred: ProviderCredential
    ) => {
      const full: ProviderDef = { type: "api", ...def };
      registerCustomProvider(full);
      saveProviderConfig({ providerId: full.id, ...cred });
      refreshProviders();
    },
    [refreshProviders]
  );

  const removeCustomProvider = useCallback(
    (id: string) => {
      unregisterCustomProvider(id);
      removeProviderConfig(id);
      refreshProviders();
      // If removed provider was active, clear selection
      setActive((prev) => {
        if (prev?.providerId === id) {
          localStorage.removeItem("niuma_active_provider_v1");
          return null;
        }
        return prev;
      });
    },
    [refreshProviders]
  );

  const resolveActive = useCallback((): ProviderConnection | null => {
    if (!active) {
      setResolveError("请先选择一个 Provider");
      return null;
    }
    const stored = getProviderConfig(active.providerId);
    const def = getProvider(active.providerId);
    if (!def) {
      setResolveError(`未知 Provider: "${active.providerId}"`);
      return null;
    }
    try {
      const conn = resolveConnection(active.providerId, {
        apiKey: stored?.apiKey ?? "",
        model: active.model,
        baseUrlOverride: stored?.baseUrlOverride,
      });
      setResolveError(null);
      return conn;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResolveError(msg);
      return null;
    }
  }, [active]);

  return {
    providers,
    active,
    selectProvider,
    saveCredential,
    getCredential: getProviderConfig,
    allCredentials: getAllProviderConfigs(),
    addCustomProvider,
    removeCustomProvider,
    resolveActive,
    resolveError,
  };
}
