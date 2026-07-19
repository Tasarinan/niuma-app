/**
 * ParticipantsPanel - right-column list of identified meeting participants.
 */
import { Mic, MonitorSpeaker, Users } from "lucide-react";
import { SpeakerTaggingPopover } from "@/components";
import type { MeetingParticipant } from "./useMeetingChannel";

function SourceIcon({ source }: { source: MeetingParticipant["source"] }) {
  if (source === "microphone") return <Mic className="size-3.5 text-indigo-500" />;
  if (source === "system") return <MonitorSpeaker className="size-3.5 text-slate-400" />;
  return <Users className="size-3.5 text-slate-300" />;
}

export function ParticipantsPanel({
  participants,
  assignSpeaker,
}: {
  participants: MeetingParticipant[];
  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;
}) {
  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Users className="size-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">
          参会人 ({participants.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {participants.length === 0 ? (
          <p className="px-2 text-xs text-slate-400">开始会议后将自动识别参会人</p>
        ) : (
          participants.map((p) => (
            <SpeakerTaggingPopover key={p.speakerId} speakerId={p.speakerId} onAssign={assignSpeaker}>
              <button className="mb-1 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50">
                <span className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <SourceIcon source={p.source} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700">{p.label}</p>
                  <p className="truncate text-[10px] text-slate-400">{p.messageCount} 条发言</p>
                </div>
              </button>
            </SpeakerTaggingPopover>
          ))
        )}
      </div>
    </aside>
  );
}
