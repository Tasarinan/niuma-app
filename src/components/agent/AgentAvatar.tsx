import { cn } from "@/lib/utils";
import { agentAvatarGlyph, isAgentAvatarImage } from "@/lib/agent/agent-avatar";

type Props = {
  src?: string | null;
  label: string;
  className?: string;
  imgClassName?: string;
  glyphClassName?: string;
};

export function AgentAvatar({ src, label, className, imgClassName, glyphClassName }: Props) {
  const image = isAgentAvatarImage(src);
  const glyph = agentAvatarGlyph(src, label);
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center overflow-hidden bg-[#f3c98f]",
        className,
      )}
    >
      {image ? (
        <img src={src!} alt={label} className={cn("h-full w-full object-cover", imgClassName)} />
      ) : (
        <span className={cn("font-bold text-slate-700", glyphClassName ?? "text-sm")}>{glyph}</span>
      )}
    </div>
  );
}
