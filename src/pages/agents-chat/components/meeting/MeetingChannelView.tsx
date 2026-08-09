/**
 * MeetingChannelView - main UI for a "meeting" GroupChannel.
 *
 * Layout:
 *   [control bar]
 *   [TranscriptFeed] | [AgentActivityPanel]
 *
 * Participants are lifted via onParticipantsChange so the parent can
 * display them in the shared right-sidebar members panel.
 */
import { useEffect } from "react";
import { useMeetingChannel, type MeetingParticipant } from "./useMeetingChannel";
import { useMeetingAgents } from "./useMeetingAgents";
import { MeetingControlBar } from "./MeetingControlBar";
import { TranscriptFeed } from "./TranscriptFeed";
import { AgentActivityPanel } from "./AgentActivityPanel";
import { PermissionFlow } from "../../../app/components/speech/PermissionFlow";
import { SetupInstructions } from "../../../app/components/speech/SetupInstructions";
import type { GroupChannel } from "@/types";

export function MeetingChannelView({
  channel,
  onParticipantsChange,
}: {
  channel: GroupChannel;
  onParticipantsChange?: (
    participants: MeetingParticipant[],
    assignSpeaker: (speakerId: string, label: string, profileId?: string) => void,
  ) => void;
}) {
  const meeting = useMeetingChannel(channel.id);

  const { notes, clearNotes, sendManualMessage } = useMeetingAgents({
    channelName: channel.name,
    agentIds: channel.agentIds,
    transcript: meeting.transcript,
    isRecording: meeting.isRecording,
  });

  useEffect(() => {
    onParticipantsChange?.(meeting.participants, meeting.assignSpeaker);
  }, [meeting.participants, meeting.assignSpeaker, onParticipantsChange]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MeetingControlBar
        isRecording={meeting.isRecording}
        onToggle={meeting.toggleMeeting}
        canUseVoice={meeting.canUseVoice}
        isProcessingSystemAudio={meeting.isProcessingSystemAudio}
        isTranscribingMic={meeting.isTranscribingMic}
        isSummarizing={meeting.isSummarizing}
        segmentCount={meeting.transcript.length}
      />
      {meeting.permissionRequired ? (
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
          <PermissionFlow
            onPermissionGranted={meeting.handlePermissionGranted}
            onPermissionDenied={() => {
              // Permission was denied, keep showing setup instructions.
            }}
          />
          <SetupInstructions setupRequired handleSetup={meeting.handleSetup} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <TranscriptFeed
            transcript={meeting.transcript}
            clearTranscript={meeting.clearTranscript}
            assignSpeaker={meeting.assignSpeaker}
            isRecording={meeting.isRecording}
            micListening={meeting.micListening}
            snapshots={meeting.snapshots}
            onSaveSnapshot={meeting.saveTranscriptSnapshot}
            onDeleteSnapshot={meeting.removeSnapshot}
          />
          <AgentActivityPanel notes={notes} clearNotes={clearNotes} onSend={sendManualMessage} />
        </div>
      )}
    </div>
  );
}
