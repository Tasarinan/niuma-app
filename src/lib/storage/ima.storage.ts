/**
 * Stores the IMA knowledge-base config for "文章资产":
 *   One KB ("文章资产") with two folders: 蜜粉 and 飞鸟.
 *
 * Credentials are NOT stored here; they are managed by the ima-skill
 * (env vars or ~/.config/ima/ files).
 */

import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "./helper";

export interface ImaArticleConfig {
  /** "文章资产" knowledge base ID */
  kbId: string;
  /** 蜜粉 folder ID within 文章资产 */
  mifenFolderId: string;
  /** 飞鸟 folder ID within 文章资产 */
  feiniaoFolderId: string;
}

const DEFAULT_CONFIG: ImaArticleConfig = {
  kbId: "SkQ3gQvMnU-7gK8iEdsc2d5eMUK2ZgK2qpxpSM8XQ2U=",
  mifenFolderId: "folder_7494266356005993",
  feiniaoFolderId: "folder_7494267337452673",
};

export function getImaKbConfig(): ImaArticleConfig {
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEYS.IMA_CONFIG);
    if (!stored) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(stored) as Partial<ImaArticleConfig>;
    return {
      kbId: parsed.kbId ?? "",
      mifenFolderId: parsed.mifenFolderId ?? "",
      feiniaoFolderId: parsed.feiniaoFolderId ?? "",
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function setImaKbConfig(config: ImaArticleConfig): void {
  safeLocalStorage.setItem(STORAGE_KEYS.IMA_CONFIG, JSON.stringify(config));
}

export function hasImaArticleConfig(): boolean {
  return Boolean(getImaKbConfig().kbId.trim());
}

