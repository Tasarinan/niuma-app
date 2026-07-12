import { createCollectionStore } from "./create-collection-store";
import { agentDefinitionRepo, skillRepo, mcpRepo, artifactRepo } from "@/lib/data";

// UI / app-shell stores
export {
  useThemeStore,
  useTheme,
  applyTheme,
  applyTransparency,
  initThemeStore,
  type Theme,
} from "./theme";
export { useApp, useAppStore, initAppStore } from "./app";
export { useLocaleStore } from "./locale";
export {
  useSidebarStore,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "./sidebar";
export { useAppModeStore, type AppMode } from "./app-mode";
export { useDebugStore } from "./debug";
export { useUnifiedStore } from "./unified";

// Collection stores (repository-backed)
export const useAgentStore = createCollectionStore(agentDefinitionRepo);
export const useSkillStore = createCollectionStore(skillRepo);
export const useMcpStore = createCollectionStore(mcpRepo);
export const useArtifactStore = createCollectionStore(artifactRepo);

export { createCollectionStore, type CollectionState } from "./create-collection-store";
