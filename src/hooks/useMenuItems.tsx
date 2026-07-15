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
  UsersIcon,
  LanguagesIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store";
import { GithubIcon } from "@/components";

export const useMenuItems = () => {
  const { hasActiveLicense } = useApp();
  const { t } = useTranslation("navigation");

  const menu: {
    icon: React.ElementType;
    label: string;
    href: string;
    count?: number;
  }[] = [
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
      icon: UsersIcon,
      label: t("speakers"),
      href: "/speakers",
    },
    {
      icon: LanguagesIcon,
      label: t("language"),
      href: "/language",
    },
    {
      icon: SquareSlashIcon,
      label: t("shortcuts"),
      href: "/shortcuts",
    },
  ];

  const footerItems = [
    ...(hasActiveLicense
      ? [
          {
            icon: MailIcon,
            label: t("footer.contactSupport"),
            action: async () => {
              try {
                await navigator.clipboard.writeText("support@niuma.com");
                alert("Email copied to clipboard: support@niuma.com");
              } catch (err) {
                alert("Support email: support@niuma.com");
              }
            },
          },
        ]
      : []),
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
      link: "https://niuma.com",
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
