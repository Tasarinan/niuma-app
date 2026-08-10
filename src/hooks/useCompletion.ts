import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useWindowResize } from "./useWindow";
import { useGlobalShortcuts } from "@/hooks";
import { MAX_FILES, STORAGE_KEYS, MEETING_ASSIST_SYSTEM_PROMPT } from "@/config";
import { useApp } from "@/store";
import {
  fetchAIResponse,
  saveConversation,
  getConversationById,
  generateConversationTitle,
  MESSAGE_ID_OFFSET,
  generateConversationId,
  generateMessageId,
  generateRequestId,
  getResponseSettings,
  createUsageRecord,
  calculateCost,
  calculateSTTCost,
  shouldUseNiumaAPI,
} from "@/lib";
import {
  summarizeConversation,
  shouldSummarize,
} from "@/lib/functions/meeting-summarizer";
import { getActiveProvider } from "@/lib/providers/storage";
import { getProvider } from "@/lib/providers/registry";
import { sendZeroTokenPrompt } from "@/lib/providers/adapters/zeroTokenService";
import {
  createAgentRuntime,
  ProviderUnavailableError,
  type AgentRuntime,
} from "@/lib/agent";
import {
  getSeedSlashCommands,
  loadSlashCommands,
  parseSlashQuery,
  rankSlashCommands,
  resolveSlashInvocation,
  type SlashCommandDefinition,
} from "@/lib/slash-commands";
import { resolveActiveConnection } from "@/lib/agent/connection";
import { useSkillStore } from "@/store";
import type { UsageData, TranscriptEntry, SpeakerInfo, AgentDefinition } from "@/types";
import { SpeakerIdFactory } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

// Types for completion
interface AttachedFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  size: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Optional translation of the message content (for STT messages) */
  translation?: string;
  /** Translation error if translation failed */
  translationError?: string;
  /** Speaker info for meeting transcripts (You vs Guest) */
  speaker?: SpeakerInfo;
  /** Audio source for meeting transcripts */
  audioSource?: 'microphone' | 'system';
}

// TranscriptEntry is now imported from @/types

/**
 * Session-level speaker mapping for within-session speaker identification.
 */
interface SessionSpeakerMapping {
  label: string; // Display name (e.g., "You", "Sarah - Client")
  profileId?: string; // If matched to enrolled profile
  assignedAt: number; // Timestamp of assignment
}

interface SessionSpeakerMap {
  [speakerId: string]: SessionSpeakerMapping;
}

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
}

function buildArgumentHint(command: SlashCommandDefinition): string | undefined {
  if (command.argumentHint?.trim()) return command.argumentHint.trim();
  if (command.arguments.length === 0) return undefined;

  const parts = command.arguments
    .map((arg) => {
      const token = arg.name || "arg";
      return arg.required ? `<${token}>` : `[${token}]`;
    })
    .slice(0, 3);

  return parts.join(" ");
}

export const useCompletion = () => {
  const {
    selectedAIProvider,
    allAiProviders,
    systemPrompt,
    screenshotConfiguration,
    setScreenshotConfiguration,
  } = useApp();
  const globalShortcuts = useGlobalShortcuts();

  const [state, setState] = useState<CompletionState>({
    input: "",
    response: "",
    isLoading: false,
    error: null,
    attachedFiles: [],
    currentConversationId: null,
    conversationHistory: [],
  });
  const [micOpen, setMicOpen] = useState(false);
  const [enableVAD, setEnableVAD] = useState(false);
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
  const [isFilesPopoverOpen, setIsFilesPopoverOpen] = useState(false);
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [keepEngaged, setKeepEngaged] = useState(false);
  const [slashCommands, setSlashCommands] = useState<SlashCommandDefinition[]>(() =>
    getSeedSlashCommands()
  );
  const [activeSlashCommandIndex, setActiveSlashCommandIndex] = useState(0);

  // Meeting Assist Mode state
  const [meetingAssistMode, setMeetingAssistMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.MEETING_ASSIST_MODE_ENABLED);
    return stored === "true";
  });
  const [meetingTranscript, setMeetingTranscript] = useState<TranscriptEntry[]>([]);

  // Session-level speaker mapping (resets when meeting transcript is cleared)
  const [sessionSpeakerMap, setSessionSpeakerMap] = useState<SessionSpeakerMap>({});

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingScreenshotRef = useRef(false);
  const screenshotConfigRef = useRef(screenshotConfiguration);
  const hasCheckedPermissionRef = useRef(false);
  const screenshotInitiatedByThisContext = useRef(false);

  const { resizeWindow } = useWindowResize();

  useEffect(() => {
    screenshotConfigRef.current = screenshotConfiguration;
  }, [screenshotConfiguration]);

  // Keep conversation history ref in sync with state (for stale closure prevention)
  useEffect(() => {
    conversationHistoryRef.current = state.conversationHistory;
  }, [state.conversationHistory]);

  // Persist Meeting Assist Mode setting
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEETING_ASSIST_MODE_ENABLED, String(meetingAssistMode));
  }, [meetingAssistMode]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<ChatMessage[]>([]);

  // Pi Agent runtime — reused across turns of the same conversation
  const piAgentRef = useRef<AgentRuntime | null>(null);
  const piConvIdRef = useRef<string | null>(null);
  // Captures the final response text from Pi's onAssistantEnd callback
  const piFullResponseRef = useRef<string>("");

  const setInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, input: value }));
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadSlashCommands().then((commands) => {
      if (!mounted) return;
      setSlashCommands(commands);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const slashQuery = useMemo(() => parseSlashQuery(state.input), [state.input]);

  const slashCommandSuggestions = useMemo(() => {
    if (slashQuery === null) return [];
    return rankSlashCommands(slashCommands, slashQuery).map((command) => ({
      name: command.name,
      description: command.description,
      sourceLabel: command.sourceLabel,
      argumentHint: buildArgumentHint(command),
    }));
  }, [slashCommands, slashQuery]);

  const isSlashMenuOpen =
    slashQuery !== null &&
    slashCommandSuggestions.length > 0 &&
    !state.isLoading;

  useEffect(() => {
    setActiveSlashCommandIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    if (slashCommandSuggestions.length === 0) {
      setActiveSlashCommandIndex(0);
      return;
    }
    setActiveSlashCommandIndex((prev) =>
      Math.max(0, Math.min(prev, slashCommandSuggestions.length - 1))
    );
  }, [slashCommandSuggestions.length]);

  const selectSlashCommand = useCallback((commandName: string) => {
    setState((prev) => ({ ...prev, input: `/${commandName} ` }));
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isSlashMenuOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSlashCommandIndex((prev) =>
          prev + 1 >= slashCommandSuggestions.length ? 0 : prev + 1
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSlashCommandIndex((prev) =>
          prev - 1 < 0 ? slashCommandSuggestions.length - 1 : prev - 1
        );
        return;
      }

      if (e.key === "Tab" || e.key === "Enter") {
        const selected = slashCommandSuggestions[activeSlashCommandIndex];
        if (!selected) return;
        e.preventDefault();
        selectSlashCommand(selected.name);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setState((prev) => ({ ...prev, input: "" }));
      }
    },
    [
      activeSlashCommandIndex,
      isSlashMenuOpen,
      selectSlashCommand,
      slashCommandSuggestions,
    ]
  );

  const setResponse = useCallback((value: string) => {
    setState((prev) => ({ ...prev, response: value }));
  }, []);

  const addFile = useCallback(async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const attachedFile: AttachedFile = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        base64,
        size: file.size,
      };

      setState((prev) => ({
        ...prev,
        attachedFiles: [...prev.attachedFiles, attachedFile],
      }));
    } catch (error) {
      console.error("Failed to process file:", error);
    }
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState((prev) => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((f) => f.id !== fileId),
    }));
  }, []);

  const clearFiles = useCallback(() => {
    setState((prev) => ({ ...prev, attachedFiles: [] }));
  }, []);

  // Meeting Assist Mode functions
  const addMeetingTranscript = useCallback((
    transcript: string,
    speakerInfo?: SpeakerInfo,
    audioSource?: 'microphone' | 'system'
  ): number => {
    const timestamp = Date.now();
    if (!transcript.trim()) return timestamp;

    // Add to meeting transcript array with TranscriptEntry structure
    const entry: TranscriptEntry = {
      original: transcript,
      timestamp,
      speaker: speakerInfo,
      audioSource,
    };
    setMeetingTranscript((prev) => [...prev, entry]);

    // Also add to conversation history as a user message (for display)
    // Use ref for conversation ID to avoid stale closure - ref is always current
    const conversationId = currentConversationIdRef.current || generateConversationId("chat");
    currentConversationIdRef.current = conversationId;

    const userMessage: ChatMessage = {
      id: generateMessageId("user", timestamp),
      role: "user",
      content: transcript,
      timestamp,
      speaker: speakerInfo,
      audioSource,
    };

    // Update ref immediately for sync
    conversationHistoryRef.current = [...conversationHistoryRef.current, userMessage];

    setState((prev) => ({
      ...prev,
      currentConversationId: conversationId,
      conversationHistory: [...prev.conversationHistory, userMessage],
    }));

    return timestamp;
  }, []); // No dependencies - uses ref for conversation ID and functional setState for latest state

  /**
   * Adds multiple transcript entries from diarization result.
   * Each entry may have speaker information attached.
   */
  const addMeetingTranscriptEntries = useCallback(
    (entries: TranscriptEntry[]): void => {
      if (entries.length === 0) return;

      // Filter out empty entries
      const validEntries = entries.filter((e) => e.original.trim());
      if (validEntries.length === 0) return;

      // Add all entries to meeting transcript
      setMeetingTranscript((prev) => [...prev, ...validEntries]);

      // Also add to conversation history as user messages (for display)
      const conversationId =
        currentConversationIdRef.current || generateConversationId("chat");
      currentConversationIdRef.current = conversationId;

      const userMessages: ChatMessage[] = validEntries.map((entry) => ({
        id: generateMessageId("user", entry.timestamp),
        role: "user" as const,
        content: entry.original,
        timestamp: entry.timestamp,
      }));

      // Update ref immediately for sync
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        ...userMessages,
      ];

      setState((prev) => ({
        ...prev,
        currentConversationId: conversationId,
        conversationHistory: [...prev.conversationHistory, ...userMessages],
      }));
    },
    []
  );

  // Update translation for a specific transcript entry (updates both meetingTranscript and conversationHistory)
  const updateTranscriptTranslation = useCallback(
    (timestamp: number, translation?: string, error?: string) => {
      // Update meetingTranscript
      setMeetingTranscript((prev) =>
        prev.map((entry) =>
          entry.timestamp === timestamp
            ? { ...entry, translation, translationError: error }
            : entry
        )
      );

      // Also update conversationHistory for the same timestamp
      // This ensures translations persist when view switches from MeetingTranscriptPanel to conversation view
      conversationHistoryRef.current = conversationHistoryRef.current.map((msg) =>
        msg.timestamp === timestamp
          ? { ...msg, translation, translationError: error }
          : msg
      );

      setState((prev) => ({
        ...prev,
        conversationHistory: prev.conversationHistory.map((msg) =>
          msg.timestamp === timestamp
            ? { ...msg, translation, translationError: error }
            : msg
        ),
      }));
    },
    []
  );

  /**
   * Adds a transcript entry from system audio (other meeting participants).
   * Labels as "Guest" with confirmed: false (can be updated by diarization later).
   *
   * Each entry gets a unique speakerId (guest_<timestamp>) so that diarization
   * can update individual entries rather than all "Guest" entries at once.
   */
  const addSystemAudioTranscript = useCallback(
    (text: string, timestamp: number): void => {
      if (!text.trim()) return;

      const entry: TranscriptEntry = {
        original: text,
        timestamp,
        audioSource: 'system',
        speaker: {
          // Unique ID per entry so diarization can update individually
          // After diarization, entries with same speaker get same speakerId
          speakerId: SpeakerIdFactory.guest(timestamp),
          speakerLabel: 'Guest',
          confirmed: false, // Will be updated by diarization in Phase 3
        },
      };

      // Just append - timestamps are monotonically increasing
      setMeetingTranscript((prev) => [...prev, entry]);

      // Also add to conversation history
      const conversationId =
        currentConversationIdRef.current || generateConversationId("chat");
      currentConversationIdRef.current = conversationId;

      const userMessage: ChatMessage = {
        id: generateMessageId("user", timestamp),
        role: "user" as const,
        content: text,
        timestamp,
        speaker: entry.speaker,
        audioSource: entry.audioSource,
      };

      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        userMessage,
      ];

      setState((prev) => ({
        ...prev,
        currentConversationId: conversationId,
        conversationHistory: [...prev.conversationHistory, userMessage],
      }));
    },
    []
  );

  const clearMeetingTranscript = useCallback(() => {
    setMeetingTranscript([]);
    // Also clear session speaker mapping
    setSessionSpeakerMap({});
    // Also reset conversation when clearing meeting transcript
    currentConversationIdRef.current = null;
    conversationHistoryRef.current = []; // Update ref immediately
    setState((prev) => ({
      ...prev,
      currentConversationId: null,
      conversationHistory: [],
      response: "",
    }));
  }, []);

  /**
   * Assigns a speaker label to a speaker ID and propagates to all matching entries.
   * Use this for manual assignment (e.g., user says "Speaker 1 is John").
   */
  const assignSpeaker = useCallback(
    (speakerId: string, label: string, profileId?: string) => {
      // Update session mapping
      setSessionSpeakerMap((prev) => ({
        ...prev,
        [speakerId]: { label, profileId, assignedAt: Date.now() },
      }));

      // Update all transcript entries with this speaker ID
      setMeetingTranscript((prev) =>
        prev.map((entry) => {
          if (entry.speaker?.speakerId === speakerId) {
            return {
              ...entry,
              speaker: {
                ...entry.speaker,
                speakerLabel: label,
                speakerProfileId: profileId,
              },
            };
          }
          return entry;
        })
      );
    },
    []
  );

  /**
   * Updates speaker info for a specific transcript entry by timestamp.
   * Used by Phase 3 diarization to assign speakers to individual entries.
   *
   * @param timestamp - The entry's timestamp (unique identifier)
   * @param speakerInfo - The new speaker info (speakerId, speakerLabel, etc.)
   */
  const updateEntrySpeaker = useCallback(
    (timestamp: number, speakerInfo: SpeakerInfo) => {
      // Update meeting transcript
      setMeetingTranscript((prev) =>
        prev.map((entry) => {
          if (entry.timestamp === timestamp) {
            return {
              ...entry,
              speaker: speakerInfo,
            };
          }
          return entry;
        })
      );

      // Update conversation history (for conversation mode display)
      conversationHistoryRef.current = conversationHistoryRef.current.map((msg) => {
        if (msg.role === "user" && msg.timestamp === timestamp) {
          return {
            ...msg,
            speaker: speakerInfo,
          };
        }
        return msg;
      });

      // Update state as well
      setState((prev) => ({
        ...prev,
        conversationHistory: conversationHistoryRef.current,
      }));

      // If this speaker has a session mapping, use it; otherwise add mapping
      // Only update if we have both speakerId and speakerLabel (required for mapping)
      const { speakerId, speakerLabel, speakerProfileId } = speakerInfo;
      if (speakerId && speakerLabel) {
        setSessionSpeakerMap((prev) => ({
          ...prev,
          [speakerId]: {
            label: speakerLabel, // Now guaranteed to be string
            profileId: speakerProfileId,
            assignedAt: Date.now(),
          },
        }));
      }
    },
    []
  );

  const submit = useCallback(
    async (speechText?: string) => {
      console.log("[Cost Tracking] submit() called");
      const input = speechText || state.input;

      if (!input.trim()) {
        console.log("[Cost Tracking] Input is empty, returning");
        return;
      }

      if (speechText) {
        setState((prev) => ({
          ...prev,
          input: speechText,
        }));
      }

      // Generate unique request ID
      const requestId = generateRequestId();
      currentRequestIdRef.current = requestId;

      // Generate conversation ID upfront for new conversations
      // This ensures the ID is available when usage events are captured
      const conversationId = state.currentConversationId || generateConversationId("chat");
      currentConversationIdRef.current = conversationId;
      console.log("[Cost Tracking] Set conversation ID ref to:", conversationId);
      if (!state.currentConversationId) {
        setState((prev) => ({
          ...prev,
          currentConversationId: conversationId,
        }));
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        // Handle image attachments
        const imagesBase64: string[] = [];
        if (state.attachedFiles.length > 0) {
          state.attachedFiles.forEach((file) => {
            if (file.type.startsWith("image/")) {
              imagesBase64.push(file.base64);
            }
          });
        }

        let fullResponse = "";

        const activeStored = getActiveProvider();
        const activeStoredDef = activeStored ? getProvider(activeStored.providerId) : null;
        const isWebProvider = activeStoredDef?.type === "web";

        // Require a configured provider
        if (!activeStored) {
          setState((prev) => ({
            ...prev,
            error: "Please configure an AI provider in Settings → AI Providers",
          }));
          return;
        }

        // Clear previous response and set loading state
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          response: "",
        }));

        try {
          if (isWebProvider && activeStored) {
            // ── Zero-token browser-session path
            const platform = activeStored.providerId.replace(/^zt-/, "");
            const result = await sendZeroTokenPrompt(platform, input);
            if (currentRequestIdRef.current !== requestId || signal.aborted) return;
            fullResponse = result;
            setState((prev) => ({ ...prev, response: result }));
          } else {
            // ── Pi Agent path for all registry API providers
            piFullResponseRef.current = "";

            // Create a new Pi agent when the conversation changes or on first call
            if (!piAgentRef.current || piConvIdRef.current !== conversationId) {
              piAgentRef.current?.abort();
              piAgentRef.current = null;

              const connection = resolveActiveConnection();
              const allSkills = useSkillStore.getState().items;
              const enabledSkillIds = allSkills
                .filter((s) => s.enabled !== false)
                .map((s) => s.id);

              const def: AgentDefinition = {
                id: `chat-${conversationId}`,
                name: "Chat",
                description: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                systemPrompt: systemPrompt || "You are a helpful assistant.",
                providerId: connection.providerId,
                modelId: connection.model,
                enabledInternalTools: ["file_search", "web_search"],
                enabledSkillIds,
                enabledMcpServerIds: [],
                sandboxMode: "read-only",
                temperature: 0.7,
                maxTokens: 4096,
                workspacePath: "",
              };

              piAgentRef.current = await createAgentRuntime(
                def,
                {
                  onAssistantDelta: (text) => {
                    // currentRequestIdRef always holds the latest requestId
                    if (signal.aborted) return;
                    piFullResponseRef.current = text;
                    setState((prev) => ({ ...prev, response: text }));
                  },
                  onAssistantEnd: (text) => {
                    piFullResponseRef.current = text;
                  },
                  onError: (message) => {
                    if (!signal.aborted) {
                      setState((prev) => ({
                        ...prev,
                        isLoading: false,
                        error: message,
                      }));
                    }
                  },
                },
                {
                  skills: allSkills,
                  mcpServers: [],
                  providerVariables: {},
                  connection,
                }
              );
              piConvIdRef.current = conversationId;
            }

            // Abort Pi agent when the AbortController fires
            const onAbort = () => piAgentRef.current?.abort();
            signal.addEventListener("abort", onAbort, { once: true });

            try {
              await piAgentRef.current.prompt(input);
              await piAgentRef.current.waitForIdle();
            } finally {
              signal.removeEventListener("abort", onAbort);
            }

            if (signal.aborted) return;
            fullResponse = piFullResponseRef.current;
          }
        } catch (e: any) {
          if (e instanceof ProviderUnavailableError) {
            if (!signal.aborted) {
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error: `Provider not configured: ${e.message}`,
              }));
            }
            return;
          }
          // Only show error if this is still the current request and not aborted
          if (currentRequestIdRef.current === requestId && !signal.aborted) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: e.message || "An error occurred",
            }));
          }
          return;
        }

        // Only proceed if this is still the current request
        if (currentRequestIdRef.current !== requestId || signal.aborted) {
          return;
        }

        setState((prev) => ({ ...prev, isLoading: false }));

        // Focus input after AI response is complete
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);

        // Save the conversation after successful completion
        if (fullResponse) {
          await saveCurrentConversation(
            input,
            fullResponse,
            state.attachedFiles
          );
          // Clear input and attached files after saving
          setState((prev) => ({
            ...prev,
            input: "",
            attachedFiles: [],
          }));
        }
      } catch (error) {
        // Only show error if not aborted
        if (!signal?.aborted && currentRequestIdRef.current === requestId) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "An error occurred",
            isLoading: false,
          }));
        }
      }
    },
    [
      state.input,
      state.attachedFiles,
      selectedAIProvider,
      allAiProviders,
      systemPrompt,
      // Note: conversationHistory removed - using conversationHistoryRef to avoid stale closure
    ]
  );

  // Submit a quick action with meeting transcript context
  const submitWithMeetingContext = useCallback(
    async (action: string) => {
      if (meetingTranscript.length === 0) {
        // No meeting context, just submit the action as a regular message
        setState((prev) => ({ ...prev, input: action }));
        await submit(action);
        return;
      }

      // Build the meeting context prompt with speaker attribution
      const meetingContext = meetingTranscript.map((entry) => {
        // Extract speaker label with fallback logic
        const speakerLabel = entry.speaker?.speakerLabel ||
          (entry.audioSource === 'microphone' ? 'You' :
           entry.audioSource === 'system' ? 'Guest' : null);

        if (speakerLabel) {
          return `${speakerLabel}: ${entry.original}`;
        }

        // No speaker info - return text as-is (backwards compatible)
        return entry.original;
      }).join("\n\n");
      const contextualPrompt = `## Meeting Transcript:\n${meetingContext}\n\n## Your Request: ${action}`;

      // Generate unique request ID
      const requestId = generateRequestId();
      currentRequestIdRef.current = requestId;

      // Generate conversation ID upfront (use "chat" type for meeting assist conversations)
      const conversationId = state.currentConversationId || generateConversationId("chat");
      currentConversationIdRef.current = conversationId;
      if (!state.currentConversationId) {
        setState((prev) => ({
          ...prev,
          currentConversationId: conversationId,
        }));
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const useNiumaAPI = await shouldUseNiumaAPI();
        if (!selectedAIProvider.provider && !useNiumaAPI) {
          setState((prev) => ({
            ...prev,
            error: "Please select an AI provider in settings",
          }));
          return;
        }

        const provider = allAiProviders.find(
          (p) => p.id === selectedAIProvider.provider
        );
        if (!provider && !useNiumaAPI) {
          setState((prev) => ({
            ...prev,
            error: "Invalid provider selected",
          }));
          return;
        }

        // Set loading state and show the action
        setState((prev) => ({
          ...prev,
          input: action,
          isLoading: true,
          error: null,
          response: "",
        }));

        let fullResponse = "";

        // Prepare message history (use ref to avoid stale closure)
        const messageHistory = conversationHistoryRef.current.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Use Meeting Assist system prompt for better context
        for await (const chunk of fetchAIResponse({
          provider: useNiumaAPI ? undefined : provider,
          selectedProvider: selectedAIProvider,
          systemPrompt: MEETING_ASSIST_SYSTEM_PROMPT,
          history: messageHistory,
          userMessage: contextualPrompt,
          signal,
        })) {
          if (currentRequestIdRef.current !== requestId || signal.aborted) {
            return;
          }

          fullResponse += chunk;
          setState((prev) => ({
            ...prev,
            response: prev.response + chunk,
          }));
        }

        if (currentRequestIdRef.current !== requestId || signal.aborted) {
          return;
        }

        setState((prev) => ({ ...prev, isLoading: false }));

        // Focus input after response
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);

        // Save the conversation (save the action, not the full contextual prompt)
        if (fullResponse) {
          const timestamp = Date.now();
          const userMsg: ChatMessage = {
            id: generateMessageId("user", timestamp),
            role: "user",
            content: action,
            timestamp,
          };
          const assistantMsg: ChatMessage = {
            id: generateMessageId("assistant", timestamp + MESSAGE_ID_OFFSET),
            role: "assistant",
            content: fullResponse,
            timestamp: timestamp + MESSAGE_ID_OFFSET,
          };
          const currentHistory = conversationHistoryRef.current;
          const newMessages = [...currentHistory, userMsg, assistantMsg];

          const conversation: ChatConversation = {
            id: conversationId,
            title: currentHistory.length === 0
              ? generateConversationTitle(action)
              : generateConversationTitle(action),
            messages: newMessages,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          await saveConversation(conversation);
          // Update ref immediately
          conversationHistoryRef.current = newMessages;
          setState((prev) => ({
            ...prev,
            currentConversationId: conversationId,
            conversationHistory: newMessages,
            input: "",
          }));
        }
      } catch (error) {
        if (!signal?.aborted && currentRequestIdRef.current === requestId) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "An error occurred",
            isLoading: false,
          }));
        }
      }
    },
    [
      meetingTranscript,
      state.currentConversationId,
      // Note: conversationHistory removed - using conversationHistoryRef to avoid stale closure
      selectedAIProvider,
      allAiProviders,
      submit,
    ]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Abort the Pi agent run if one is in progress
    piAgentRef.current?.abort();
    currentRequestIdRef.current = null;
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const reset = useCallback(() => {
    // Don't reset if keep engaged mode is active
    if (keepEngaged) {
      return;
    }
    cancel();
    setState((prev) => ({
      ...prev,
      input: "",
      response: "",
      error: null,
      attachedFiles: [],
    }));
  }, [cancel, keepEngaged]);

  // Helper function to convert file to base64
  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string)?.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
    });
  }, []);

  // Note: saveConversation, getConversationById, and generateConversationTitle
  // are now imported from lib/database/chat-history.action.ts

  // Helper function to summarize the current conversation before switching
  const summarizeCurrentConversation = useCallback(async () => {
    // Need at least 2 exchanges (4 messages: 2 user + 2 assistant)
    if (!state.currentConversationId || state.conversationHistory.length < 4) {
      return;
    }

    // Convert ChatMessage[] to Message[] format
    const messages = state.conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Check if should summarize (has enough exchanges)
    if (!shouldSummarize(messages)) {
      return;
    }

    // Get provider config for AI summarization
    const useNiumaAPI = await shouldUseNiumaAPI();
    const provider = allAiProviders.find(p => p.id === selectedAIProvider.provider);

    // Trigger summarization asynchronously (don't await - non-blocking)
    summarizeConversation(
      state.currentConversationId,
      messages,
      useNiumaAPI ? undefined : provider ? {
        provider,
        selectedProvider: selectedAIProvider,
      } : undefined
    ).then(success => {
      if (success) {
        console.log("[Context Memory] Conversation summarized successfully");
      }
    }).catch(error => {
      console.error("[Context Memory] Failed to summarize conversation:", error);
    });
  }, [
    state.currentConversationId,
    state.conversationHistory,
    allAiProviders,
    selectedAIProvider
  ]);

  const loadConversation = useCallback((conversation: ChatConversation) => {
    // Summarize current conversation before switching
    summarizeCurrentConversation();
    // Reset Pi agent — new conversation = new agent context
    piAgentRef.current?.abort();
    piAgentRef.current = null;
    piConvIdRef.current = null;

    currentConversationIdRef.current = conversation.id;
    conversationHistoryRef.current = conversation.messages; // Update ref immediately
    setState((prev) => ({
      ...prev,
      currentConversationId: conversation.id,
      conversationHistory: conversation.messages,
      input: "",
      response: "",
      error: null,
      isLoading: false,
    }));
  }, [summarizeCurrentConversation]);

  const startNewConversation = useCallback(() => {
    // Summarize current conversation before starting new
    summarizeCurrentConversation();
    // Reset Pi agent — fresh conversation
    piAgentRef.current?.abort();
    piAgentRef.current = null;
    piConvIdRef.current = null;

    currentConversationIdRef.current = null;
    conversationHistoryRef.current = []; // Update ref immediately
    setState((prev) => ({
      ...prev,
      currentConversationId: null,
      conversationHistory: [],
      input: "",
      response: "",
      error: null,
      isLoading: false,
      attachedFiles: [],
    }));
  }, [summarizeCurrentConversation]);

  const saveCurrentConversation = useCallback(
    async (
      userMessage: string,
      assistantResponse: string,
      _attachedFiles: AttachedFile[]
    ) => {
      // Validate inputs
      if (!userMessage || !assistantResponse) {
        console.error("Cannot save conversation: missing message content");
        return;
      }

      const conversationId =
        state.currentConversationId || generateConversationId("chat");
      const timestamp = Date.now();

      const userMsg: ChatMessage = {
        id: generateMessageId("user", timestamp),
        role: "user",
        content: userMessage,
        timestamp,
      };

      const assistantMsg: ChatMessage = {
        id: generateMessageId("assistant", timestamp + MESSAGE_ID_OFFSET),
        role: "assistant",
        content: assistantResponse,
        timestamp: timestamp + MESSAGE_ID_OFFSET,
      };

      // Use ref to avoid stale closure
      const currentHistory = conversationHistoryRef.current;
      const newMessages = [...currentHistory, userMsg, assistantMsg];

      // Get existing conversation if updating
      let existingConversation = null;
      if (state.currentConversationId) {
        try {
          existingConversation = await getConversationById(
            state.currentConversationId
          );
        } catch (error) {
          console.error("Failed to get existing conversation:", error);
        }
      }

      const title =
        currentHistory.length === 0
          ? generateConversationTitle(userMessage)
          : existingConversation?.title ||
            generateConversationTitle(userMessage);

      const conversation: ChatConversation = {
        id: conversationId,
        title,
        messages: newMessages,
        createdAt: existingConversation?.createdAt || timestamp,
        updatedAt: timestamp,
      };

      try {
        await saveConversation(conversation);

        // Update ref immediately
        conversationHistoryRef.current = newMessages;
        setState((prev) => ({
          ...prev,
          currentConversationId: conversationId,
          conversationHistory: newMessages,
        }));
      } catch (error) {
        console.error("Failed to save conversation:", error);
        // Show error to user
        setState((prev) => ({
          ...prev,
          error: "Failed to save conversation. Please try again.",
        }));
      }
    },
    [state.currentConversationId] // Note: conversationHistory removed - using conversationHistoryRef
  );

  // Listen for conversation events from the main ChatHistory component
  useEffect(() => {
    const handleConversationSelected = async (event: any) => {
      console.log(event, "event");
      // Only the conversation ID is passed through the event
      const { id } = event.detail;
      console.log(id, "id");
      if (!id || typeof id !== "string") {
        console.error("No conversation ID provided");
        setState((prev) => ({
          ...prev,
          error: "Invalid conversation selected",
        }));
        return;
      }
      console.log(id, "id");
      try {
        // Fetch the full conversation from SQLite
        const conversation = await getConversationById(id);

        if (conversation) {
          loadConversation(conversation);
        } else {
          console.error(`Conversation ${id} not found in database`);
          setState((prev) => ({
            ...prev,
            error: "Conversation not found. It may have been deleted.",
          }));
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to load conversation. Please try again.",
        }));
      }
    };

    const handleNewConversation = () => {
      startNewConversation();
    };

    const handleConversationDeleted = (event: any) => {
      const deletedId = event.detail;
      // If the currently active conversation was deleted, start a new one
      if (state.currentConversationId === deletedId) {
        startNewConversation();
      }
    };

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === "Niuma-conversation-selected" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          const { id } = data;
          if (id && typeof id === "string") {
            const conversation = await getConversationById(id);
            if (conversation) {
              loadConversation(conversation);
            }
          }
        } catch (error) {
          console.error("Failed to parse conversation selection:", error);
        }
      }
    };

    window.addEventListener("conversationSelected", handleConversationSelected);
    window.addEventListener("newConversation", handleNewConversation);
    window.addEventListener("conversationDeleted", handleConversationDeleted);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "conversationSelected",
        handleConversationSelected
      );
      window.removeEventListener("newConversation", handleNewConversation);
      window.removeEventListener(
        "conversationDeleted",
        handleConversationDeleted
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadConversation, startNewConversation, state.currentConversationId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILES = 6;

    files.forEach((file) => {
      if (
        file.type.startsWith("image/") &&
        state.attachedFiles.length < MAX_FILES
      ) {
        addFile(file);
      }
    });

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleScreenshotSubmit = useCallback(
    async (base64: string, prompt?: string) => {
      if (state.attachedFiles.length >= MAX_FILES) {
        setState((prev) => ({
          ...prev,
          error: `You can only upload ${MAX_FILES} files`,
        }));
        return;
      }

      try {
        if (prompt) {
          // Auto mode: Submit directly to AI with screenshot
          const attachedFile: AttachedFile = {
            id: Date.now().toString(),
            name: `screenshot_${Date.now()}.png`,
            type: "image/png",
            base64: base64,
            size: base64.length,
          };

          // Generate unique request ID
          const requestId = generateRequestId();
          currentRequestIdRef.current = requestId;

          // Cancel any existing request
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          abortControllerRef.current = new AbortController();
          const signal = abortControllerRef.current.signal;

          try {
            // Prepare message history for the AI (use ref to avoid stale closure)
            const messageHistory = conversationHistoryRef.current.map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

            let fullResponse = "";

            const useNiumaAPI = await shouldUseNiumaAPI();
            // Check if AI provider is configured
            if (!selectedAIProvider.provider && !useNiumaAPI) {
              setState((prev) => ({
                ...prev,
                error: "Please select an AI provider in settings",
              }));
              return;
            }

            const provider = allAiProviders.find(
              (p) => p.id === selectedAIProvider.provider
            );
            if (!provider && !useNiumaAPI) {
              setState((prev) => ({
                ...prev,
                error: "Invalid provider selected",
              }));
              return;
            }

            // Clear previous response and set loading state
            setState((prev) => ({
              ...prev,
              input: prompt,
              isLoading: true,
              error: null,
              response: "",
            }));

            // Use the fetchAIResponse function with image and signal
            for await (const chunk of fetchAIResponse({
              provider: useNiumaAPI ? undefined : provider,
              selectedProvider: selectedAIProvider,
              systemPrompt: systemPrompt || undefined,
              history: messageHistory,
              userMessage: prompt,
              imagesBase64: [base64],
              signal,
            })) {
              // Only update if this is still the current request
              if (currentRequestIdRef.current !== requestId || signal.aborted) {
                return; // Request was superseded or cancelled
              }

              fullResponse += chunk;
              setState((prev) => ({
                ...prev,
                response: prev.response + chunk,
              }));
            }

            // Only proceed if this is still the current request
            if (currentRequestIdRef.current !== requestId || signal.aborted) {
              return;
            }

            setState((prev) => ({ ...prev, isLoading: false }));

            // Focus input after screenshot AI response is complete
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);

            // Save the conversation after successful completion
            if (fullResponse) {
              await saveCurrentConversation(prompt, fullResponse, [
                attachedFile,
              ]);
              // Clear input after saving
              setState((prev) => ({
                ...prev,
                input: "",
              }));
            }
          } catch (e: any) {
            // Only show error if this is still the current request and not aborted
            if (currentRequestIdRef.current === requestId && !signal.aborted) {
              setState((prev) => ({
                ...prev,
                error: e.message || "An error occurred",
              }));
            }
          } finally {
            // Only update loading state if this is still the current request
            if (currentRequestIdRef.current === requestId && !signal.aborted) {
              setState((prev) => ({ ...prev, isLoading: false }));
            }
          }
        } else {
          // Manual mode: Add to attached files
          const attachedFile: AttachedFile = {
            id: Date.now().toString(),
            name: `screenshot_${Date.now()}.png`,
            type: "image/png",
            base64: base64,
            size: base64.length,
          };

          setState((prev) => ({
            ...prev,
            attachedFiles: [...prev.attachedFiles, attachedFile],
          }));
        }
      } catch (error) {
        console.error("Failed to process screenshot:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "An error occurred processing screenshot",
          isLoading: false,
        }));
      }
    },
    [
      state.attachedFiles.length,
      // Note: conversationHistory removed - using conversationHistoryRef to avoid stale closure
      selectedAIProvider,
      allAiProviders,
      systemPrompt,
      saveCurrentConversation,
      inputRef,
    ]
  );

  const onRemoveAllFiles = () => {
    clearFiles();
    setIsFilesPopoverOpen(false);
  };

  /**
   * Stream a one-shot AI response through the active Pi agent without touching
   * main conversation state. Used by the quick-search panel to generate its
   * AI summary through the same assistant as the main chat.
   */
  const streamOnce = useCallback(async (
    prompt: string,
    systemPromptText: string,
    onDelta: (text: string) => void,
    signal: AbortSignal
  ): Promise<void> => {
    const connection = resolveActiveConnection();
    const allSkills = useSkillStore.getState().items;
    const enabledSkillIds = allSkills
      .filter((s) => s.enabled !== false)
      .map((s) => s.id);

    const def: AgentDefinition = {
      id: `quick-${Date.now()}`,
      name: "Quick",
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      systemPrompt: systemPromptText,
      providerId: connection.providerId,
      modelId: connection.model,
      enabledInternalTools: [],
      enabledSkillIds,
      enabledMcpServerIds: [],
      sandboxMode: "read-only",
      temperature: 0.7,
      maxTokens: 2048,
      workspacePath: "",
    };

    const agent = await createAgentRuntime(
      def,
      {
        onAssistantDelta: (text) => { if (!signal.aborted) onDelta(text); },
        onAssistantEnd: () => {},
        onError: (msg) => console.error("[streamOnce]", msg),
      },
      {
        skills: allSkills,
        mcpServers: [],
        providerVariables: {},
        connection,
      }
    );

    const onAbort = () => agent.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await agent.prompt(prompt);
      await agent.waitForIdle();
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }, []);

  /**
   * Routes plain typed text from the toolbar's "Ask me anything" input into
   * the AgentChat window's single-agent "main chat" channel instead of
   * running the local one-shot completion popover. Opens/focuses the
   * AgentChat window so the user sees the conversation there.
   *
   * `text` may be empty — in that case no message is sent, but the window is
   * still opened/focused, so the toolbar can act as a plain "open agent-chat"
   * shortcut even with nothing typed.
   */
  const sendToMainChat = useCallback(async (text: string) => {
    const trimmed = text.trim();

    const resolution = resolveSlashInvocation(trimmed, slashCommands);
    const routedText = resolution?.kind === "prompt" ? resolution.text : trimmed;

    try {
      if (routedText) {
        await emit("agent-chat:incoming-message", { text: routedText });
      }
      await invoke("open_agent_chat_window");
    } catch (err) {
      console.error("Failed to route message to AgentChat:", err);
    }
  }, [slashCommands]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // When slash suggestion menu is open, Enter is handled by handleInputKeyDown
      // to pick the active command and should not submit the message.
      if (isSlashMenuOpen) {
        return;
      }

      if (!state.isLoading) {
        const text = state.input;
        setState((prev) => ({ ...prev, input: "" }));
        void sendToMainChat(text);
      }
    }
  };


  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      // Check if clipboard contains images
      const items = e.clipboardData?.items;
      if (!items) return;

      const hasImages = Array.from(items).some((item) =>
        item.type.startsWith("image/")
      );

      // If we have images, prevent default text pasting and process images
      if (hasImages) {
        e.preventDefault();

        const processedFiles: File[] = [];

        Array.from(items).forEach((item) => {
          if (
            item.type.startsWith("image/") &&
            state.attachedFiles.length + processedFiles.length < MAX_FILES
          ) {
            const file = item.getAsFile();
            if (file) {
              processedFiles.push(file);
            }
          }
        });

        // Process all files
        await Promise.all(processedFiles.map((file) => addFile(file)));
      }
    },
    [state.attachedFiles.length, addFile]
  );

  // Check if meeting transcript should trigger popover
  const hasMeetingTranscript = meetingAssistMode && meetingTranscript.length > 0;

  // Popover opens when there's content to show
  const isPopoverOpen =
    state.isLoading ||
    state.response !== "" ||
    state.error !== null ||
    keepEngaged ||
    hasMeetingTranscript;

  useEffect(() => {
    resizeWindow(
      isPopoverOpen || micOpen || messageHistoryOpen || isFilesPopoverOpen
    );
  }, [
    isPopoverOpen,
    micOpen,
    messageHistoryOpen,
    resizeWindow,
    isFilesPopoverOpen,
  ]);

  // Auto scroll to bottom when response updates
  useEffect(() => {
    const responseSettings = getResponseSettings();
    if (
      !keepEngaged &&
      state.response &&
      scrollAreaRef.current &&
      responseSettings.autoScroll
    ) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [state.response, keepEngaged]);

  // Keyboard arrow key support for scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPopoverOpen) return;

      const activeScrollRef = scrollAreaRef.current || scrollAreaRef.current;
      const scrollElement = activeScrollRef?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;

      if (!scrollElement) return;

      const scrollAmount = 100; // pixels to scroll

      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollElement.scrollBy({ top: scrollAmount, behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollElement.scrollBy({ top: -scrollAmount, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPopoverOpen, scrollAreaRef]);

  // Keyboard shortcut for toggling keep engaged mode (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleToggleShortcut = (e: KeyboardEvent) => {
      // Only trigger when popover is open
      if (!isPopoverOpen) return;

      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setKeepEngaged((prev) => !prev);
        // Focus the input after toggle (with delay to ensure DOM is ready)
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener("keydown", handleToggleShortcut);
    return () => window.removeEventListener("keydown", handleToggleShortcut);
  }, [isPopoverOpen]);

  const captureScreenshot = useCallback(async () => {
    if (!handleScreenshotSubmit) return;

    const config = screenshotConfigRef.current;
    screenshotInitiatedByThisContext.current = true;
    setIsScreenshotLoading(true);

    try {
      // Check screen recording permission on macOS
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("mac") && !hasCheckedPermissionRef.current) {
        const {
          checkScreenRecordingPermission,
          requestScreenRecordingPermission,
        } = await import("tauri-plugin-macos-permissions-api");

        const hasPermission = await checkScreenRecordingPermission();

        if (!hasPermission) {
          // Request permission
          await requestScreenRecordingPermission();

          // Wait a moment and check again
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const hasPermissionNow = await checkScreenRecordingPermission();

          if (!hasPermissionNow) {
            setState((prev) => ({
              ...prev,
              error:
                "Screen Recording permission required. Please enable it by going to System Settings > Privacy & Security > Screen & System Audio Recording. If you don't see Niuma in the list, click the '+' button to add it. If it's already listed, make sure it's enabled. Then restart the app.",
            }));
            setIsScreenshotLoading(false);
            screenshotInitiatedByThisContext.current = false;
            return;
          }
        }
        hasCheckedPermissionRef.current = true;
      }

      if (config.enabled) {
        const base64 = await invoke("capture_to_base64");
        await invoke("save_capture_snapshot", { base64Data: base64 as string });

        if (config.mode === "auto") {
          // Auto mode: Submit directly to AI with the configured prompt
          await handleScreenshotSubmit(base64 as string, config.autoPrompt);
        } else if (config.mode === "manual") {
          // Manual mode: Add to attached files without prompt
          await handleScreenshotSubmit(base64 as string);
        }
        screenshotInitiatedByThisContext.current = false;
      } else {
        // Selection Mode: Open overlay to select an area
        isProcessingScreenshotRef.current = false;
        await invoke("start_screen_capture");
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "Failed to capture screenshot. Please try again.",
      }));
      isProcessingScreenshotRef.current = false;
      screenshotInitiatedByThisContext.current = false;
    } finally {
      if (config.enabled) {
        setIsScreenshotLoading(false);
      }
    }
  }, [handleScreenshotSubmit]);

  useEffect(() => {
    let unlisten: any;

    const setupListener = async () => {
      unlisten = await listen("captured-selection", async (event: any) => {
        if (!screenshotInitiatedByThisContext.current) {
          return;
        }

        if (isProcessingScreenshotRef.current) {
          return;
        }

        isProcessingScreenshotRef.current = true;
        const base64 = event.payload;
        const config = screenshotConfigRef.current;

        try {
          await invoke("save_capture_snapshot", { base64Data: base64 as string });

          if (config.mode === "auto") {
            // Auto mode: Submit directly to AI with the configured prompt
            await handleScreenshotSubmit(base64 as string, config.autoPrompt);
          } else if (config.mode === "manual") {
            // Manual mode: Add to attached files without prompt
            await handleScreenshotSubmit(base64 as string);
          }
        } catch (error) {
          console.error("Error processing selection:", error);
        } finally {
          setIsScreenshotLoading(false);
          screenshotInitiatedByThisContext.current = false;
          setTimeout(() => {
            isProcessingScreenshotRef.current = false;
          }, 100);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleScreenshotSubmit]);

  useEffect(() => {
    const unlisten = listen("capture-closed", () => {
      setIsScreenshotLoading(false);
      isProcessingScreenshotRef.current = false;
      screenshotInitiatedByThisContext.current = false;
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleRecording = useCallback(() => {
    setEnableVAD(!enableVAD);
    setMicOpen(!micOpen);
  }, [enableVAD, micOpen]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      currentRequestIdRef.current = null;
    };
  }, []);

  // Listen for API usage events and save to database
  useEffect(() => {
    const handleUsageCaptured = async (event: Event) => {
      console.log("[Cost Tracking] Received api-usage-captured event");
      const customEvent = event as CustomEvent<{
        usage: UsageData;
        provider: string;
        model: string;
      }>;

      const { usage, provider, model } = customEvent.detail;
      console.log("[Cost Tracking] Event detail:", { usage, provider, model });

      // Use ref for conversation ID (more reliable than state during async operations)
      // If no conversation ID, use a system ID for tracking uncategorized usage (like translations)
      const conversationId = currentConversationIdRef.current || "system-uncategorized";
      console.log("[Cost Tracking] Current conversation ID from ref:", conversationId);

      try {
        const cost = calculateCost(usage, provider, model);
        console.log("[Cost Tracking] Calculated cost:", cost);

        const record = {
          id: crypto.randomUUID(),
          conversationId,
          provider,
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
          timestamp: Date.now(),
        };
        console.log("[Cost Tracking] Creating usage record:", record);

        await createUsageRecord(record);
        console.log("[Cost Tracking] Usage record saved successfully!");
      } catch (error) {
        console.error("[Cost Tracking] Failed to save API usage record:", error);
      }
    };

    console.log("[Cost Tracking] Setting up api-usage-captured event listener");
    window.addEventListener("api-usage-captured", handleUsageCaptured);
    return () => {
      console.log("[Cost Tracking] Removing api-usage-captured event listener");
      window.removeEventListener("api-usage-captured", handleUsageCaptured);
    };
  }, []);

  // Listen for STT usage events and save to database
  useEffect(() => {
    const handleSTTUsageCaptured = async (event: Event) => {
      console.log("[Cost Tracking STT] Received stt-usage-captured event");
      const customEvent = event as CustomEvent<{
        provider: string;
        model: string;
        audioSeconds: number;
      }>;

      const { provider, model, audioSeconds } = customEvent.detail;
      console.log("[Cost Tracking STT] Event detail:", { provider, model, audioSeconds });

      // Use ref for conversation ID (more reliable than state during async operations)
      // If no conversation ID, use a system ID for tracking uncategorized usage
      const conversationId = currentConversationIdRef.current || "system-uncategorized";
      console.log("[Cost Tracking STT] Current conversation ID from ref:", conversationId);

      try {
        const cost = calculateSTTCost(audioSeconds, provider, model);
        console.log("[Cost Tracking STT] Calculated cost:", cost);

        await createUsageRecord({
          id: crypto.randomUUID(),
          conversationId,
          provider: `${provider}-stt`, // Mark as STT usage
          model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          audioSeconds,
          estimatedCost: cost,
          timestamp: Date.now(),
        });
        console.log("[Cost Tracking STT] STT usage record saved successfully!");
      } catch (error) {
        console.error("[Cost Tracking STT] Failed to save STT usage record:", error);
      }
    };

    window.addEventListener("stt-usage-captured", handleSTTUsageCaptured);
    return () => {
      window.removeEventListener("stt-usage-captured", handleSTTUsageCaptured);
    };
  }, []);

  // register callbacks for global shortcuts
  useEffect(() => {
    globalShortcuts.registerAudioCallback(toggleRecording);
    globalShortcuts.registerInputRef(inputRef.current);
    globalShortcuts.registerScreenshotCallback(captureScreenshot);
  }, [
    globalShortcuts.registerAudioCallback,
    globalShortcuts.registerInputRef,
    globalShortcuts.registerScreenshotCallback,
    toggleRecording,
    captureScreenshot,
    inputRef,
  ]);

  return {
    input: state.input,
    setInput,
    response: state.response,
    setResponse,
    isLoading: state.isLoading,
    error: state.error,
    attachedFiles: state.attachedFiles,
    addFile,
    removeFile,
    clearFiles,
    submit,
    cancel,
    reset,
    setState,
    enableVAD,
    setEnableVAD,
    micOpen,
    setMicOpen,
    currentConversationId: state.currentConversationId,
    conversationHistory: state.conversationHistory,
    loadConversation,
    startNewConversation,
    messageHistoryOpen,
    setMessageHistoryOpen,
    screenshotConfiguration,
    setScreenshotConfiguration,
    handleScreenshotSubmit,
    handleFileSelect,
    handleKeyPress,
    handleInputKeyDown,
    handlePaste,
    slashCommandSuggestions,
    isSlashMenuOpen,
    activeSlashCommandIndex,
    selectSlashCommand,
    isPopoverOpen,
    scrollAreaRef,
    resizeWindow,
    isFilesPopoverOpen,
    setIsFilesPopoverOpen,
    onRemoveAllFiles,
    inputRef,
    captureScreenshot,
    isScreenshotLoading,
    keepEngaged,
    setKeepEngaged,
    sendToMainChat,
    streamOnce,
    // Meeting Assist Mode
    meetingAssistMode,
    setMeetingAssistMode,
    meetingTranscript,
    addMeetingTranscript,
    addMeetingTranscriptEntries,
    addSystemAudioTranscript,
    updateTranscriptTranslation,
    clearMeetingTranscript,
    submitWithMeetingContext,
    // Speaker Diarization
    sessionSpeakerMap,
    assignSpeaker,
    updateEntrySpeaker,
  };
};
