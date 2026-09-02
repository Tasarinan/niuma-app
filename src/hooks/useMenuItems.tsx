import {
  Settings,
  AudioLinesIcon,
  SquareSlashIcon,
  MonitorIcon,
  PowerIcon,
  MailIcon,
  GlobeIcon,
  BugIcon,
  MessageSquareTextIcon,
  DollarSignIcon,
  BrainIcon,
  LanguagesIcon,
  BotIcon,
  PlugIcon,
  ZapIcon,
  TimerIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components";

export const useMenuItems = () => {
  const { t } = useTranslation("navigation");

  const menu: {
    icon: React.ElementType;
    label: string;
    href: string;
    count?: number;
  }[] = [
    {
      icon: BotIcon,
      label: t("agents"),
      href: "/agents",
    },
    {
      icon: TimerIcon,
      label: "番茄钟",
      href: "/pomodoro",
    },
    {
      icon: ZapIcon,
      label: t("skills"),
      href: "/skills",
    },
    {
      icon: PlugIcon,
      label: t("providers"),
      href: "/providers",
    },
    {
      icon: Settings,
      label: t("settings"),
      href: "/settings",
    },
    {
      icon: MessageSquareTextIcon,
      label: t("responses"),
      href: "/responses",
    },
    {
      icon: DollarSignIcon,
      label: t("costTracking"),
      href: "/cost-tracking",
    },
    {
      icon: BrainIcon,
      label: t("contextMemory"),
      href: "/context-memory",
    },
    {
      icon: MonitorIcon,
      label: t("screenshot"),
      href: "/screenshot",
    },
    {
      icon: AudioLinesIcon,
      label: t("audio"),
      href: "/audio",
    },
    {
      icon: LanguagesIcon,
      label: t("speechRecognition"),
      href: "/speakers",
    },
    {
      icon: SquareSlashIcon,
      label: t("shortcuts"),
      href: "/shortcuts",
    },
  ];

  const footerItems = [
    {
      id: "contact-support",
      icon: MailIcon,
      label: t("footer.contactSupport"),
      action: async () => {
        try {
          await navigator.clipboard.writeText("niuma8@888.com");
          alert("Email copied to clipboard: niuma8@888.com");
        } catch (err) {
          alert("Support email: niuma8@888.com");
        }
      },
    },
    {
      icon: BugIcon,
      label: t("footer.reportBug"),
      href: "https://github.com/Tasarinan/niuma-app/issues/new?template=bug-report.yml",
    },
    {
      icon: PowerIcon,
      label: t("footer.quit"),
      action: async () => {
        await invoke("exit_app");
      },
    },
  ];

  const footerLinks: {
    title: string;
    icon: React.ElementType;
    link: string;
  }[] = [
    {
      title: t("footer.website"),
      icon: GlobeIcon,
      link: "https://niuma-app.com",
    },
    {
      title: t("footer.github"),
      icon: GithubIcon,
      link: "https://github.com/Tasarinan/niuma-app",
    },
  ];

  return {
    menu,
    footerItems,
    footerLinks,
  };
};
