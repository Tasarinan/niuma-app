import {
  Theme,
  AlwaysOnTopToggle,
  AppIconToggle,
  AutostartToggle,
  ContentProtectedToggle,
  DeleteChats,
  LocaleToggle,
} from "./components";
import { PageLayout } from "@/components/layouts";
import { useTranslation } from "react-i18next";

const Settings = () => {
  const { t } = useTranslation("pages");
  return (
    <PageLayout title={t("settingsPage.title")} description={t("settingsPage.description")}>
      {/* Language */}
      <LocaleToggle />

      {/* Theme */}
      <Theme />

      {/* Autostart Toggle */}
      <AutostartToggle />

      {/* App Icon Toggle */}
      <AppIconToggle />

      {/* Always On Top Toggle */}
      <AlwaysOnTopToggle />

      {/* Content Protection Toggle */}
      <ContentProtectedToggle />

      {/* Delete All Chats */}
      <DeleteChats />
    </PageLayout>
  );
};

export default Settings;
