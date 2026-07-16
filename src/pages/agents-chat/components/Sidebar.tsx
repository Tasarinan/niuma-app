import { useTranslation } from "react-i18next";
import { Brain, FileText, MessageSquare, Settings, Zap } from "lucide-react";
import type { Section } from "../index";

const NAV_ITEM_DEFS: { id: Section; icon: React.ElementType }[] = [
  { id: "chat", icon: MessageSquare },
  { id: "agents", icon: Brain },
  { id: "skills", icon: Zap },
  { id: "articles", icon: FileText },
];

interface SidebarProps {
  section: Section;
  onSectionChange: (section: Section) => void;
}

/** Left navigation rail — mirrors DeDeClaw style. */
export const Sidebar = ({ section, onSectionChange }: SidebarProps) => {
  const { t } = useTranslation("pages");

  const navItems = NAV_ITEM_DEFS.map(({ id, icon }) => ({
    id,
    icon,
    label: t(`agentsChat.tabs.${id}`),
  }));

  return (
    <nav className="flex w-12 flex-shrink-0 flex-col items-center bg-[#2C2D33] pb-3 pt-6">
      {/* Nav items */}
      <div className="flex flex-col items-center gap-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = section === id;
          return (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              title={label}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200",
                isActive
                  ? "bg-[#3E3F47] text-white scale-105 shadow-sm"
                  : "text-gray-400 hover:bg-[#3E3F47] hover:text-gray-200",
              ].join(" ")}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          );
        })}
      </div>

      {/* Settings at bottom */}
      <div className="mt-auto">
        <button
          title={t("agentsChat.settingsTitle")}
          onClick={() => onSectionChange(section === "settings" ? "chat" : "settings")}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200",
            section === "settings"
              ? "bg-[#3E3F47] text-white scale-105 shadow-sm"
              : "text-gray-500 hover:bg-[#3E3F47] hover:text-gray-300",
          ].join(" ")}
        >
          <Settings size={16} strokeWidth={section === "settings" ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
};
