import type { CSSProperties, ReactNode } from "react";

type LegacySection = "chat" | "agents" | "skills" | "articles" | "settings";

interface PageContainerProps {
  pageId: LegacySection;
  current: LegacySection;
  children: ReactNode;
}

/** Mirrors Ima PageContainer: all pages mounted, shown/hidden via display.
 *  Uses display:block so child pages fill the full width naturally and
 *  h-full / ScrollArea flex-1 resolve correctly.
 */
export function PageContainer({ pageId, current, children }: PageContainerProps) {
  const style: CSSProperties = {
    display: pageId === current ? "block" : "none",
    flex: 1,
    height: "100%",
    overflow: "hidden",
  };
  return <div style={style}>{children}</div>;
}
