import { useEffect, useState } from "react";
import { Button, Card } from "@/components";
import { CheckCircle2Icon, LoaderIcon, ShieldAlertIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface PermissionFlowProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

type PermissionState = "checking" | "granted" | "denied" | "requesting";

export const PermissionFlow = ({
  onPermissionGranted,
  onPermissionDenied,
}: PermissionFlowProps) => {
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
                  Checking Permissions
                </h3>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Verifying system audio access permissions...
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
                  Permission Granted!
                </h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  System audio access is enabled. Starting capture...
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
                  Waiting for Permission
                </h3>
                <p className="text-xs text-orange-800 leading-relaxed mb-3">
                  System Settings should have opened. Please:
                </p>
                <ol className="text-xs text-orange-800 space-y-1 list-decimal list-inside mb-3">
                  <li>
                    Go to <strong>Privacy & Security</strong>
                  </li>
                  <li>
                    Select <strong>Screen & System Audio Recording</strong>
                  </li>
                  <li>
                    Find <strong>Niuma</strong> and enable it
                  </li>
                  <li className="font-semibold text-orange-900">
                    Return here - we'll detect it automatically!
                  </li>
                </ol>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-orange-700">
                    Checking... ({checkAttempts}/20)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkPermission}
                    className="text-xs"
                  >
                    Check Now
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
                  Permission Required
                </h3>
                <p className="text-xs text-red-800 leading-relaxed mb-3">
                  Niuma needs permission to capture system audio. This is
                  required for the system audio feature to work.
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={requestPermission}
                    className="w-full"
                    size="sm"
                  >
                    Grant Permission
                  </Button>

                  <details className="text-xs text-red-800">
                    <summary className="cursor-pointer font-medium mb-2">
                      Manual Setup Instructions
                    </summary>
                    <ol className="list-decimal list-inside space-y-1 mt-2 pl-2">
                      <li>
                        Open <strong>System Settings</strong>
                      </li>
                      <li>
                        Navigate to <strong>Privacy & Security</strong>
                      </li>
                      <li>
                        Click on{" "}
                        <strong>Screen & System Audio Recording</strong>
                      </li>
                      <li>
                        Find <strong>Niuma</strong> in the list
                      </li>
                      <li>
                        Toggle the switch to <strong>ON</strong>
                      </li>
                      <li>Restart Niuma if needed</li>
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
