import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMenuItems } from "@/hooks";
import { Button } from "@/components";

const Dashboard = () => {
  const { t } = useTranslation("dashboard");
  const { footerLinks, footerItems } = useMenuItems();

  return (
    <div className="flex h-full w-full flex-col items-center gap-8 overflow-y-auto px-8 py-10">
      <img
        src="/niuma_brand.png"
        alt="Niuma"
        className="w-32 object-contain"
        draggable={false}
      />
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {t("overview")}
        </p>
        <p className="text-base text-muted-foreground">{t("tagline")}</p>
      </div>

      {/* Footer links (website / github) */}
      <div className="flex flex-row gap-3">
        {footerLinks.map((item) => (
          <Button
            key={item.title}
            title={item.title}
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => openUrl(item.link)}
          >
            <item.icon className="size-4" />
            {item.title}
          </Button>
        ))}
      </div>

      {/* Footer items (contact support / report bug / quit) */}
      <div className="flex flex-col w-48 gap-1">
        {footerItems.map((item, index) => {
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            if (item.action) {
              void item.action();
            } else if (item.href) {
              void openUrl(item.href);
            }
          };
          return (
            <button
              key={`footer-${index}`}
              onClick={handleClick}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;

