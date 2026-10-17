export const NIUMA_LOCAL_STORAGE_SET_EVENT = "niuma:local-storage-set";

function notifyLocalStorageWrite(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(NIUMA_LOCAL_STORAGE_SET_EVENT, { detail: { key } }),
    );
  } catch {
    // ignore
  }
}

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
      notifyLocalStorageWrite(key);
    } catch {}
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
