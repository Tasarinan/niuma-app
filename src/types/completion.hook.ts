import {
  Dispatch,
  SetStateAction,
  RefObject,
  KeyboardEvent,
  ChangeEvent,
  ClipboardEvent,
} from "react";
import { TranscriptEntry, SpeakerInfo } from "./completion";

// Re-export TranscriptEntry and SpeakerInfo for convenience
export type { TranscriptEntry, SpeakerInfo };

/**
 * Type definition for the useCompletion hook return value
 * This hook manages the complete state and functionality for AI completion interactions
 */
export interface UseCompletionReturn {
  // Input management
  /** Current input text value */
  input: string;
  /** Function to update the input text */
  setInput: (value: string) => void;

  // Response management
  /** Current AI response text */
  response: string;
  /** Function to update the response text */
  setResponse: (value: string) => void;

  // Loading and error states
  /** Whether a completion request is currently in progress */
  isLoading: boolean;
  /** Current error message, null if no error */
  error: string | null;

  // File attachment management
  /** Array of currently attached files */
  attachedFiles: any[];
  /** Function to add a file to attachments */
  addFile: (file: File) => Promise<void>;
  /** Function to remove a file by its ID */
  removeFile: (fileId: string) => void;
  /** Function to clear all attached files */
  clearFiles: () => void;

  // Completion actions
  /** Function to submit the completion request, optionally with speech text */
  submit: (speechText?: string) => Promise<void>;
  /** Function to cancel the current completion request */
  cancel: () => void;
  /** Function to reset the completion state (clears input, response, error, files) */
  reset: () => void;

  // State management
  /** Direct state setter for advanced use cases */
  setState: Dispatch<SetStateAction<any>>;

  // Voice Activity Detection (VAD) and microphone
  /** Whether Voice Activity Detection is enabled */
  enableVAD: boolean;
  /** Function to toggle VAD state */
  setEnableVAD: Dispatch<SetStateAction<boolean>>;
  /** Whether microphone is currently open/active */
  micOpen: boolean;
  /** Function to control microphone state */
  setMicOpen: Dispatch<SetStateAction<boolean>>;

  // Conversation management
  /** ID of the currently active conversation, null for new conversation */
  currentConversationId: string | null;
  /** Array of messages in the current conversation */
  conversationHistory: any[];
  /** Function to load an existing conversation */
  loadConversation: (conversation: any) => void;
  /** Function to start a new conversation (clears current state) */
  startNewConversation: () => void;

  // UI state management
  /** Whether the message history modal/panel is open */
  messageHistoryOpen: boolean;
  /** Function to control message history panel visibility */
  setMessageHistoryOpen: Dispatch<SetStateAction<boolean>>;
  /** Whether keep engaged mode is active (keeps popover open for continuous conversation) */
  keepEngaged: boolean;
  /** Function to toggle keep engaged mode */
  setKeepEngaged: Dispatch<SetStateAction<boolean>>;

  // Screenshot functionality
  /** Current screenshot configuration settings */
  screenshotConfiguration: any;
  /** Function to update screenshot configuration */
  setScreenshotConfiguration: Dispatch<SetStateAction<any>>;
  /** Function to handle screenshot submission with optional prompt */
  handleScreenshotSubmit: (base64: string, prompt?: string) => Promise<void>;

  // File selection and keyboard handling
  /** Event handler for file input changes */
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Event handler for keyboard interactions (Enter to submit) */
  handleKeyPress: (e: KeyboardEvent) => void;
  /** Event handler for paste events to handle image pasting */
  handlePaste: (e: ClipboardEvent) => Promise<void>;

  // UI helpers and computed values
  /** Whether any popover/modal should be open (computed from loading/response/error state) */
  isPopoverOpen: boolean;
  /** Ref for the scroll area container (for auto-scrolling) */
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  /** Function to resize the application window based on UI state */
  resizeWindow: (expanded: boolean) => Promise<void>;

  // Files popover management
  /** Whether the files attachment popover is open */
  isFilesPopoverOpen: boolean;
  /** Function to control files popover visibility */
  setIsFilesPopoverOpen: Dispatch<SetStateAction<boolean>>;
  /** Function to remove all files and close the files popover */
  onRemoveAllFiles: () => void;

  /** Ref for the input element */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Function to capture a screenshot */
  captureScreenshot: () => Promise<void>;
  /** Whether a screenshot is currently loading */
  isScreenshotLoading: boolean;

  // Meeting Assist Mode
  /** Whether Meeting Assist Mode is enabled (accumulates transcripts instead of auto-responding) */
  meetingAssistMode: boolean;
  /** Function to toggle Meeting Assist Mode */
  setMeetingAssistMode: Dispatch<SetStateAction<boolean>>;
  /** Accumulated meeting transcript segments with translations */
  meetingTranscript: TranscriptEntry[];
  /** Function to add a transcript segment to the meeting transcript with optional speaker info */
  addMeetingTranscript: (
    transcript: string,
    speakerInfo?: SpeakerInfo,
    audioSource?: 'microphone' | 'system'
  ) => number;
  /** Function to add multiple transcript entries with speaker info from diarization */
  addMeetingTranscriptEntries: (entries: TranscriptEntry[]) => void;
  /** Function to add a transcript entry from system audio (labeled as "Guest") */
  addSystemAudioTranscript: (text: string, timestamp: number) => void;
  /** Function to update translation for a specific transcript entry */
  updateTranscriptTranslation: (timestamp: number, translation?: string, error?: string) => void;
  /** Function to clear the meeting transcript */
  clearMeetingTranscript: () => void;
  /** Function to submit a quick action with meeting context */
  submitWithMeetingContext: (action: string) => Promise<void>;

  // Speaker Diarization
  /** Session-level speaker mapping for within-session speaker identification */
  sessionSpeakerMap: Record<string, { label: string; profileId?: string; assignedAt: number }>;
  /** Function to assign a speaker label to a speaker ID (propagates to all matching entries) */
  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;
  /** Function to update speaker info for a specific entry by timestamp (used by diarization) */
  updateEntrySpeaker: (timestamp: number, speakerInfo: SpeakerInfo) => void;
}

/**
 * Type for the useCompletion hook function signature
 */
export type UseCompletionHook = () => UseCompletionReturn;
