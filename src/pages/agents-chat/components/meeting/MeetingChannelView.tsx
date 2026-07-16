/**
 * MeetingChannelView - main UI for a "meeting" GroupChannel.
 * Renders in place of the normal message stream + input box: a control bar,
 * a center transcript feed, and a right-hand identified-participants panel.
 */
import { useMeetingChannel } from "./useMeetingChannel";
import { MeetingControlBar } from "./MeetingControlBar";
import { TranscriptFeed } from "./TranscriptFeed";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PermissionFlow } from "../../../app/components/speech/PermissionFlow";
import { SetupInstructions } from "../../../app/components/speech/SetupInstructions";
import type { GroupChannel } from "@/types";

export function MeetingChannelView({ channel }: { channel: GroupChannel }) {
  const meeting = useMeetingChannel(channel.id);

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
          />
          <ParticipantsPanel participants={meeting.participants} assignSpeaker={meeting.assignSpeaker} />
        </div>
      )}
    </div>
  );
}
