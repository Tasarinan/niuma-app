export interface TYPE_PROVIDER {
  id?: string;
  name?: string;
  streaming?: boolean;
  responseContentPath?: string;
  isCustom?: boolean;
  curl: string;
  // For providers that require special handling (e.g., multi-step APIs like AssemblyAI)
  requiresSpecialHandler?: boolean;
  specialHandler?: string;
  /**
   * Whether this STT provider supports automatic language detection.
   * When true, setting language to "auto" will work correctly.
   * When false or undefined, a specific language code should be provided.
   */
  supportsAutoDetect?: boolean;
}
