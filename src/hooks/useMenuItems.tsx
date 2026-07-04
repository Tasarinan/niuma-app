import {
  Settings,
  Code,
  MessagesSquare,
  WandSparkles,
  AudioLinesIcon,
  SquareSlashIcon,
  MonitorIcon,
  HomeIcon,
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
import { useApp } from "@/contexts";
import { GithubIcon } from "@/components";

export const useMenuItems = () => {
  const { hasActiveLicense } = useApp();

  const menu: {
    icon: React.ElementType;
    label: string;
    href: string;
    count?: number;
  }[] = [
    {
      icon: HomeIcon,
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      icon: MessagesSquare,
      label: "Chats",
      href: "/chats",
    },
    {
      icon: WandSparkles,
      label: "System prompts",
      href: "/system-prompts",
    },
    {
      icon: Settings,
      label: "App Settings",
      href: "/settings",
    },
    {
      icon: MessageSquareTextIcon,
      label: "Responses",
      href: "/responses",
    },
    {
      icon: DollarSignIcon,
      label: "Cost Tracking",
      href: "/cost-tracking",
    },
    {
      icon: BrainIcon,
      label: "Context Memory",
      href: "/context-memory",
    },
    {
      icon: MonitorIcon,
      label: "Screenshot",
      href: "/screenshot",
    },
    {
      icon: AudioLinesIcon,
      label: "Audio",
      href: "/audio",
    },
    {
      icon: UsersIcon,
      label: "Speakers",
      href: "/speakers",
    },
    {
      icon: LanguagesIcon,
      label: "Language",
      href: "/language",
    },
    {
      icon: SquareSlashIcon,
      label: "Cursor & Shortcuts",
      href: "/shortcuts",
    },

    {
      icon: Code,
      label: "Dev space",
      href: "/dev-space",
    },
  ];

  const footerItems = [
    ...(hasActiveLicense
      ? [
          {
            icon: MailIcon,
            label: "Contact Support",
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
      label: "Report a bug",
      href: "https://github.com/kmorgan-r/Niuma/issues/new?template=bug-report.yml",
    },
    {
      icon: PowerIcon,
      label: "Quit Niuma",
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
      title: "Website",
      icon: GlobeIcon,
      link: "https://niuma.com",
    },
    {
      title: "Github",
      icon: GithubIcon,
      link: "https://github.com/kmorgan-r/Niuma",
    },
  ];

  return {
    menu,
    footerItems,
    footerLinks,
  };
};
