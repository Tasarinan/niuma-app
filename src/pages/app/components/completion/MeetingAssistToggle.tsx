import { UseCompletionReturn } from "@/types";
import { Switch } from "@/components";
import { UsersIcon } from "lucide-react";

interface MeetingAssistToggleProps {
  meetingAssistMode: UseCompletionReturn["meetingAssistMode"];
  setMeetingAssistMode: UseCompletionReturn["setMeetingAssistMode"];
  meetingTranscript: UseCompletionReturn["meetingTranscript"];
}

export const MeetingAssistToggle = ({
  meetingAssistMode,
  setMeetingAssistMode,
  meetingTranscript,
}: MeetingAssistToggleProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
          meetingAssistMode
            ? "bg-primary/10 text-primary"
            : "bg-muted/50 text-muted-foreground"
        }`}
      >
        <UsersIcon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium select-none">Meeting</span>
        {meetingAssistMode && meetingTranscript.length > 0 && (
          <span className="text-[10px] bg-primary/20 px-1.5 py-0.5 rounded-full">
            {meetingTranscript.length}
          </span>
        )}
      </div>
      <Switch
        checked={meetingAssistMode}
        onCheckedChange={setMeetingAssistMode}
        className="scale-75"
      />
    </div>
  );
};
