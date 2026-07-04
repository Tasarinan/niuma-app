import { invoke } from "@tauri-apps/api/core";
import { safeLocalStorage } from "../storage";
import { STORAGE_KEYS } from "@/config";

// Helper function to check if Niuma API should be used
export async function shouldUseNiumaAPI(): Promise<boolean> {
  try {
    // Check if Niuma API is enabled in localStorage
    const NiumaApiEnabled =
      safeLocalStorage.getItem(STORAGE_KEYS.Niuma_API_ENABLED) === "true";
    if (!NiumaApiEnabled) return false;

    // Check if license is available
    const hasLicense = await invoke<boolean>("check_license_status");
    return hasLicense;
  } catch (error) {
    console.warn("Failed to check Niuma API availability:", error);
    return false;
  }
}
