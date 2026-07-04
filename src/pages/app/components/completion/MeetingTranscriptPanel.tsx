import { UseCompletionReturn, SpeakerInfo, SpeakerId, SpeakerIdParser } from "@/types";
import { Button, ScrollArea, SpeakerTaggingPopover } from "@/components";
import { TrashIcon, UsersIcon, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useApp } from "@/contexts";

// Speaker color palette for visual distinction
const SPEAKER_COLORS: Record<string, string> = {
  A: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  B: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  C: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  D: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
  E: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30",
  F: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  user: "bg-primary/20 text-primary border-primary/30",
};

/**
 * Get speaker color based on speaker ID.
 * Handles both new prefixed IDs and legacy IDs.
 */
function getSpeakerColor(speakerId: string): string {
  // Handle new prefixed speaker IDs
  const idType = SpeakerIdParser.getType(speakerId as SpeakerId);

  if (idType === "source") {
    if (SpeakerIdParser.isYou(speakerId as SpeakerId)) {
      return SPEAKER_COLORS.user;
    }
    // Guest - use default color
    return SPEAKER_COLORS.A;
  }

  if (idType === "diarization") {
    const label = SpeakerIdParser.getDiarizationLabel(speakerId as SpeakerId);
    return SPEAKER_COLORS[label || "A"] || SPEAKER_COLORS.A;
  }

  if (idType === "profile") {
    // For profiles, we could maintain consistent colors per profile
    // For now, use a default color
    return SPEAKER_COLORS.A;
  }

  // Legacy format fallback
  if (speakerId === "user" || speakerId === "You") {
    return SPEAKER_COLORS.user;
  }
  return SPEAKER_COLORS[speakerId] || SPEAKER_COLORS.A;
}

function getSpeakerLabel(speaker: SpeakerInfo | undefined): string | null {
  if (!speaker) return null;
  // Use custom label if available, otherwise show "Speaker X"
  return speaker.speakerLabel || `Speaker ${speaker.speakerId}`;
}

interface MeetingTranscriptPanelProps {
  meetingTranscript: UseCompletionReturn["meetingTranscript"];
  clearMeetingTranscript: UseCompletionReturn["clearMeetingTranscript"];
  assignSpeaker?: UseCompletionReturn["assignSpeaker"];
}

export const MeetingTranscriptPanel = ({
  meetingTranscript,
  clearMeetingTranscript,
  assignSpeaker,
}: MeetingTranscriptPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sttTranslationEnabled } = useApp();

  // Auto-scroll to bottom when new transcripts are added
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [meetingTranscript]);

  if (meetingTranscript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <UsersIcon className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">Meeting Assist Mode</p>
        <p className="text-xs mt-1 text-center max-w-[200px]">
          Start speaking to capture meeting audio. Use Quick Actions to get AI insights.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-xs select-none">
            Meeting Transcript
          </h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {meetingTranscript.length} segment{meetingTranscript.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearMeetingTranscript}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <TrashIcon className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {meetingTranscript.map((entry, index) => {
            const speakerLabel = getSpeakerLabel(entry.speaker);
            const speakerId = entry.speaker?.speakerId || "diarization_A";
            const hasSpeaker = !!entry.speaker;

            return (
              <div
                key={entry.timestamp}
                className={`p-3 rounded-lg bg-muted/50 text-sm border-l-2 ${
                  hasSpeaker
                    ? getSpeakerColor(speakerId).split(" ").find(c => c.startsWith("border-")) || "border-primary/30"
                    : "border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {/* Speaker label - clickable for tagging when assignSpeaker is available */}
                  {hasSpeaker && speakerLabel && (
                    assignSpeaker ? (
                      <SpeakerTaggingPopover
                        speakerId={speakerId}
                        onAssign={assignSpeaker}
                      >
                        <button
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${getSpeakerColor(
                            speakerId
                          )}`}
                        >
                          {speakerLabel}
                        </button>
                      </SpeakerTaggingPopover>
                    ) : (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${getSpeakerColor(
                          speakerId
                        )}`}
                      >
                        {speakerLabel}
                      </span>
                    )
                  )}

                  {/* Segment number (shown if no speaker) */}
                  {!hasSpeaker && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      #{index + 1}
                    </span>
                  )}

                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Confidence indicator for low confidence matches */}
                  {entry.speaker?.needsConfirmation && (
                    <span className="text-[9px] text-amber-600 dark:text-amber-400">
                      (unconfirmed)
                    </span>
                  )}
                </div>

                {/* Original text */}
                <p className="text-foreground">{entry.original}</p>

                {/* Translation section */}
                {sttTranslationEnabled && (
                  <div className="mt-2 pt-2 border-t border-muted">
                    {entry.translation ? (
                      <p className="text-foreground/80 italic" dir="auto">
                        {entry.translation}
                      </p>
                    ) : entry.translationError ? (
                      <p className="text-destructive/70 text-xs">
                        Translation unavailable
                      </p>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Translating...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
