import { useEffect, useState } from "react";
import { Button, Card } from "@/components";
import { CheckCircle2Icon, LoaderIcon, ShieldAlertIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

interface PermissionFlowProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

type PermissionState = "checking" | "granted" | "denied" | "requesting";

export const PermissionFlow = ({
  onPermissionGranted,
  onPermissionDenied,
}: PermissionFlowProps) => {
  const { t } = useTranslation("pages");
  const [permissionState, setPermissionState] =
    useState<PermissionState>("checking");
  const [checkAttempts, setCheckAttempts] = useState(0);

  // Initial permission check
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      setPermissionState("checking");
      const hasAccess = await invoke<boolean>("check_system_audio_access");

      if (hasAccess) {
        setPermissionState("granted");
        setTimeout(() => onPermissionGranted(), 500);
      } else {
        setPermissionState("denied");
        onPermissionDenied();
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      setPermissionState("denied");
      onPermissionDenied();
    }
  };

  const requestPermission = async () => {
    try {
      setPermissionState("requesting");
      await invoke("request_system_audio_access");

      // Start polling for permission grant
      let attempts = 0;
      const maxAttempts = 20; // Poll for up to 20 seconds

      const pollInterval = setInterval(async () => {
        attempts++;
        setCheckAttempts(attempts);

        try {
          const hasAccess = await invoke<boolean>("check_system_audio_access");

          if (hasAccess) {
            clearInterval(pollInterval);
            setPermissionState("granted");
            setTimeout(() => onPermissionGranted(), 500);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setPermissionState("denied");
            onPermissionDenied();
          }
        } catch (error) {
          console.error("Permission poll failed:", error);
        }
      }, 1000);
    } catch (error) {
      console.error("Permission request failed:", error);
      setPermissionState("denied");
      onPermissionDenied();
    }
  };

  const renderContent = () => {
    switch (permissionState) {
      case "checking":
        return (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <LoaderIcon className="w-6 h-6 text-blue-600 animate-spin flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-blue-900 mb-1">
                  {t("systemAudioPermission.checkingTitle")}
                </h3>
                <p className="text-xs text-blue-800 leading-relaxed">
                  {t("systemAudioPermission.checkingDesc")}
                </p>
              </div>
            </div>
          </Card>
        );

      case "granted":
        return (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-green-900 mb-1">
                  {t("systemAudioPermission.grantedTitle")}
                </h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  {t("systemAudioPermission.grantedDesc")}
                </p>
              </div>
            </div>
          </Card>
        );

      case "requesting":
        return (
          <Card className="p-6 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <LoaderIcon className="w-6 h-6 text-orange-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-orange-900 mb-2">
                  {t("systemAudioPermission.waitingTitle")}
                </h3>
                <p className="text-xs text-orange-800 leading-relaxed mb-3">
                  {t("systemAudioPermission.waitingDesc")}
                </p>
                <ol className="text-xs text-orange-800 space-y-1 list-decimal list-inside mb-3">
                  <li>
                    {t("systemAudioPermission.stepPrivacy")}{" "}
                    <strong>{t("systemAudioPermission.privacySecurity")}</strong>
                  </li>
                  <li>
                    {t("systemAudioPermission.stepScreenRecording")}{" "}
                    <strong>{t("systemAudioPermission.screenAudioRecording")}</strong>
                  </li>
                  <li>
                    {t("systemAudioPermission.stepFindApp")}{" "}
                    <strong>{t("systemAudioPermission.appName")}</strong>{" "}
                    {t("systemAudioPermission.stepFindAppSuffix")}
                  </li>
                  <li className="font-semibold text-orange-900">
                    {t("systemAudioPermission.stepReturn")}
                  </li>
                </ol>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-orange-700">
                    {t("systemAudioPermission.checkingAttempts", { count: checkAttempts })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkPermission}
                    className="text-xs"
                  >
                    {t("systemAudioPermission.checkNow")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );

      case "denied":
        return (
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <ShieldAlertIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-red-900 mb-2">
                  {t("systemAudioPermission.deniedTitle")}
                </h3>
                <p className="text-xs text-red-800 leading-relaxed mb-3">
                  {t("systemAudioPermission.deniedDesc")}
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={requestPermission}
                    className="w-full"
                    size="sm"
                  >
                    {t("systemAudioPermission.grantPermission")}
                  </Button>

                  <details className="text-xs text-red-800">
                    <summary className="cursor-pointer font-medium mb-2">
                      {t("systemAudioPermission.manualSetupInstructions")}
                    </summary>
                    <ol className="list-decimal list-inside space-y-1 mt-2 pl-2">
                      <li>
                        {t("systemAudioPermission.stepOpenSettings")}{" "}
                        <strong>{t("systemAudioPermission.systemSettings")}</strong>
                      </li>
                      <li>
                        {t("systemAudioPermission.stepNavigatePrivacy")}{" "}
                        <strong>{t("systemAudioPermission.privacySecurity")}</strong>
                      </li>
                      <li>
                        {t("systemAudioPermission.stepClickScreenRecording")}{" "}
                        <strong>{t("systemAudioPermission.screenAudioRecording")}</strong>
                      </li>
                      <li>
                        {t("systemAudioPermission.stepFindInList")}{" "}
                        <strong>{t("systemAudioPermission.appName")}</strong>
                      </li>
                      <li>
                        {t("systemAudioPermission.stepToggleOn")}{" "}
                        <strong>{t("systemAudioPermission.on")}</strong>
                      </li>
                      <li>{t("systemAudioPermission.stepRestart")}</li>
                    </ol>
                  </details>
                </div>
              </div>
            </div>
          </Card>
        );
    }
  };

  return <div className="space-y-4">{renderContent()}</div>;
};
