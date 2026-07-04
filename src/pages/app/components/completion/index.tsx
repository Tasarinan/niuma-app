import { useCompletion, useQuickActions } from "@/hooks";
import { Screenshot } from "./Screenshot";
import { Files } from "./Files";
import { Audio } from "./Audio";
import { Input } from "./Input";
import { MeetingAssistToggle } from "./MeetingAssistToggle";

export const Completion = ({ isHidden }: { isHidden: boolean }) => {
  const completion = useCompletion();
  const quickActions = useQuickActions();

  // Use meeting-aware quick action handler when in Meeting Assist Mode
  const handleQuickAction = (action: string) => {
    if (completion.meetingAssistMode) {
      // In Meeting Assist Mode, use the context-aware submit
      completion.submitWithMeetingContext(action);
    } else {
      // Normal mode: just submit the action
      completion.submit(action);
    }
  };

  return (
    <>
      <MeetingAssistToggle
        meetingAssistMode={completion.meetingAssistMode}
        setMeetingAssistMode={completion.setMeetingAssistMode}
        meetingTranscript={completion.meetingTranscript}
      />
      <Audio {...completion} />
      <Input
        {...completion}
        isHidden={isHidden}
        quickActions={quickActions}
        onQuickActionClick={handleQuickAction}
      />
      <Screenshot {...completion} />
      <Files {...completion} />
    </>
  );
};
