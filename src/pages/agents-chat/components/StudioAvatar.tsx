import { cn } from "@/lib/utils";

/** Render an agent/project avatar that may be an emoji or an image URL. */
export function StudioAvatar({
  avatar,
  name,
  className,
}: {
  avatar?: string;
  name?: string;
  className?: string;
}) {
  const isImage =
    !!avatar && (avatar.startsWith("/") || avatar.startsWith("http"));
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-fuchsia-500/10 text-xs font-medium text-fuchsia-600 dark:text-fuchsia-300",
        className
      )}
    >
      {isImage ? (
        <img src={avatar} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span>{avatar || name?.[0] || "?"}</span>
      )}
    </div>
  );
}
