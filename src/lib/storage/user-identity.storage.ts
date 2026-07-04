import { STORAGE_KEYS } from "@/config";
import { UserIdentity } from "@/types";
import { safeLocalStorage } from "./helper";

/**
 * Gets the user identity from localStorage.
 * Returns null if not configured or invalid.
 */
export function getUserIdentity(): UserIdentity | null {
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEYS.USER_IDENTITY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.name === "string" &&
      typeof parsed.role === "string"
    ) {
      return {
        name: parsed.name,
        role: parsed.role,
      };
    }

    return null;
  } catch (error) {
    console.warn("Failed to parse user identity:", error);
    return null;
  }
}

/**
 * Saves the user identity to localStorage.
 */
export function setUserIdentity(identity: UserIdentity): void {
  safeLocalStorage.setItem(
    STORAGE_KEYS.USER_IDENTITY,
    JSON.stringify(identity)
  );
}

/**
 * Checks if a valid user identity is configured.
 * Returns true only if both name and role are non-empty strings.
 */
export function hasUserIdentity(): boolean {
  const identity = getUserIdentity();
  return Boolean(identity?.name?.trim() && identity?.role?.trim());
}

/**
 * Clears the user identity from localStorage.
 */
export function clearUserIdentity(): void {
  safeLocalStorage.removeItem(STORAGE_KEYS.USER_IDENTITY);
}
