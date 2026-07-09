import { create } from "zustand";
import {
  DEFAULT_UNIFIED_CONFIG,
  clearUnifiedLogs,
  getUnifiedLogs,
  getUnifiedStats,
  getUnifiedStatus,
  loadUnifiedConfig,
  pushUnifiedConfig,
  saveUnifiedConfig,
  startUnified,
  stopUnified,
  type CallLogRecord,
  type RouteInput,
  type UnifiedApiConfig,
  type UnifiedStats,
  type UnifiedStatus,
} from "@/lib/unified-api";

interface UnifiedState {
  config: UnifiedApiConfig;
  status: UnifiedStatus | null;
  logs: CallLogRecord[];
  stats: UnifiedStats | null;
  routes: RouteInput[];
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  setConfig: (patch: Partial<UnifiedApiConfig>) => Promise<void>;
  setRoutes: (routes: RouteInput[]) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  refreshStats: () => Promise<void>;
  clearLogs: () => Promise<void>;
  /** Append a live record pushed from the CALL_LOG_EVENT listener. */
  appendLog: (record: CallLogRecord) => void;
}

export const useUnifiedStore = create<UnifiedState>((set, get) => ({
  config: DEFAULT_UNIFIED_CONFIG,
  status: null,
  logs: [],
  stats: null,
  routes: [],
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const config = await loadUnifiedConfig();
      const status = await pushUnifiedConfig(config, get().routes);
      const logs = await getUnifiedLogs();
      set({ config, status, logs, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setConfig: async (patch) => {
    const config = { ...get().config, ...patch };
    await saveUnifiedConfig(config);
    const status = await pushUnifiedConfig(config, get().routes);
    set({ config, status });
  },

  setRoutes: async (routes) => {
    const status = await pushUnifiedConfig(get().config, routes);
    set({ routes, status });
  },

  start: async () => {
    const status = await startUnified();
    set({ status });
  },

  stop: async () => {
    const status = await stopUnified();
    set({ status });
  },

  refreshStatus: async () => {
    set({ status: await getUnifiedStatus() });
  },

  refreshLogs: async () => {
    set({ logs: await getUnifiedLogs() });
  },

  refreshStats: async () => {
    set({ stats: await getUnifiedStats() });
  },

  clearLogs: async () => {
    await clearUnifiedLogs();
    set({ logs: [], stats: null });
  },

  appendLog: (record) => {
    set({ logs: [...get().logs, record].slice(-2000) });
  },
}));
