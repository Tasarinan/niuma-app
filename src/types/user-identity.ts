// User Identity Types

/**
 * Represents the user's identity for AI context and filtering.
 * Used to help AI recognize the user vs. other meeting participants.
 */
export interface UserIdentity {
  /** User's primary name (e.g., "Kevin") */
  name: string;
  /** User's professional role (e.g., "Software Engineer") */
  role: string;
}
