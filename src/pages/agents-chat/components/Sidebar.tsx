import { useTranslation } from "react-i18next";
import { Brain, FileText, MessageSquare, Settings, Zap } from "lucide-react";

type LegacySection = "chat" | "agents" | "skills" | "articles" | "settings";

const NAV_ITEM_DEFS: { id: LegacySection; icon: React.ElementType }[] = [
  { id: "chat", icon: MessageSquare },
  { id: "agents", icon: Brain },
  { id: "skills", icon: Zap },
  { id: "articles", icon: FileText },
];

interface SidebarProps {
  section: LegacySection;
  onSectionChange: (section: LegacySection) => void;
}

/** Left navigation rail — mirrors Ima style. */
export const Sidebar = ({ section, onSectionChange }: SidebarProps) => {
  const { t } = useTranslation("pages");

  const navItems = NAV_ITEM_DEFS.map(({ id, icon }) => ({
    id,
    icon,
    label: t(`agentsChat.tabs.${id}`),
  }));

  return (
    <nav className="flex w-16 flex-shrink-0 flex-col items-center border-r border-slate-200 bg-slate-50 pb-4 pt-5">
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
                "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                isActive
                  ? "bg-indigo-600 text-white scale-105 shadow-lg shadow-indigo-200/60"
                  : "text-slate-400 hover:bg-white hover:text-slate-700",
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
            "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
            section === "settings"
              ? "bg-indigo-600 text-white scale-105 shadow-lg shadow-indigo-200/60"
              : "text-slate-400 hover:bg-white hover:text-slate-700",
          ].join(" ")}
        >
          <Settings size={16} strokeWidth={section === "settings" ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
};
