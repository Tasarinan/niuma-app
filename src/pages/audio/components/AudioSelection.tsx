import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Header,
  Button,
} from "@/components";
import { MicIcon, RefreshCwIcon, HeadphonesIcon } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/contexts";
import { STORAGE_KEYS } from "@/config/constants";
import { safeLocalStorage } from "@/lib/storage";

export const AudioSelection = () => {
  const { selectedAudioDevices, setSelectedAudioDevices } = useApp();

  const [devices, setDevices] = useState<{
    input: MediaDeviceInfo[];
    output: MediaDeviceInfo[];
  }>({
    input: [],
    output: [],
  });
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [showSuccess, setShowSuccess] = useState<{
    input: boolean;
    output: boolean;
  }>({
    input: false,
    output: false,
  });

  // Helper function to restore or set default device
  const restoreOrSetDefaultDevice = (
    type: "input" | "output",
    devices: MediaDeviceInfo[],
    storageKey: string
  ) => {
    const savedDeviceId = safeLocalStorage.getItem(storageKey);
    const shouldRestore =
      savedDeviceId && devices.some((d) => d.deviceId === savedDeviceId);

    if (shouldRestore) {
      setSelectedAudioDevices((prev) => ({ ...prev, [type]: savedDeviceId }));
    } else if (devices.length > 0) {
      const defaultDevice = devices.find((d) => d.deviceId === "default");
      const selectedId = defaultDevice?.deviceId || devices[0].deviceId;

      setSelectedAudioDevices((prev) => ({ ...prev, [type]: selectedId }));
      safeLocalStorage.setItem(storageKey, selectedId);
    }
  };

  // Load all audio devices (input and output)
  const loadAudioDevices = async () => {
    setIsLoadingDevices(true);
    try {
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setTimeout(async () => {
        stream.getTracks().forEach((track) => track.stop());
      }, 2000);

      // Enumerate all audio devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      console.log(allDevices, "allDevices");
      const audioInputs = allDevices.filter(
        (device) => device.kind === "audioinput"
      );
      const audioOutputs = allDevices.filter(
        (device) => device.kind === "audiooutput"
      );

      setDevices({ input: audioInputs, output: audioOutputs });

      // Restore or set default devices
      restoreOrSetDefaultDevice(
        "input",
        audioInputs,
        STORAGE_KEYS.SELECTED_AUDIO_INPUT_DEVICE
      );
      restoreOrSetDefaultDevice(
        "output",
        audioOutputs,
        STORAGE_KEYS.SELECTED_AUDIO_OUTPUT_DEVICE
      );
    } catch (error) {
      console.error("Error loading audio devices:", error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // Handle device selection changes
  const handleDeviceChange = (type: "input" | "output", deviceId: string) => {
    setSelectedAudioDevices((prev) => ({
      ...prev,
      [type]: deviceId,
    }));

    const storageKey =
      type === "input"
        ? STORAGE_KEYS.SELECTED_AUDIO_INPUT_DEVICE
        : STORAGE_KEYS.SELECTED_AUDIO_OUTPUT_DEVICE;

    safeLocalStorage.setItem(storageKey, deviceId);

    setShowSuccess((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setShowSuccess((prev) => ({ ...prev, [type]: false }));
    }, 3000);
  };

  return (
    <div id="audio" className="space-y-1 flex flex-col gap-4">
      {/* Microphone Input Section */}
      <div className="space-y-3">
        <Header
          title="Microphone"
          description="Select your microphone for voice input and speech-to-text. If issues occur, adjust your system's default microphone in OS settings."
        />

        <div className="space-y-3">
          {/* Microphone Selection Dropdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={selectedAudioDevices.input}
                onValueChange={(value) => handleDeviceChange("input", value)}
                disabled={isLoadingDevices || devices.input.length === 0}
              >
                <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <MicIcon className="size-4" />
                    <div className="text-sm font-medium truncate">
                      {isLoadingDevices
                        ? "Loading microphones..."
                        : devices.input.length === 0
                        ? "No microphones found"
                        : devices.input.find(
                            (mic) => mic.deviceId === selectedAudioDevices.input
                          )?.label || "Select a microphone"}
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {devices.input.map((mic) => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      <div className="flex items-center gap-2">
                        <MicIcon className="size-4" />
                        <div className="font-medium truncate">
                          {mic.label ||
                            `Microphone ${mic.deviceId.slice(0, 8)}`}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Refresh button */}
              <Button
                size="icon"
                variant="outline"
                onClick={loadAudioDevices}
                disabled={isLoadingDevices}
                className="h-11 w-11 shrink-0"
                title="Refresh microphone list"
              >
                <RefreshCwIcon
                  className={`size-4 ${isLoadingDevices ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Success message */}
          {showSuccess.input && (
            <div className="text-xs text-green-500 bg-green-500/10 p-3 rounded-md">
              <strong>✓ Microphone changed successfully!</strong>
              <br />
              Using:{" "}
              {devices.input.find(
                (mic) => mic.deviceId === selectedAudioDevices.input
              )?.label || "Unknown device"}
            </div>
          )}

          {/* Permission Notice */}
          {devices.input.length === 0 && !isLoadingDevices && (
            <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-md">
              <strong>
                ⚠️ Click the refresh button to load your microphone devices.
              </strong>{" "}
              If this doesn't work, try changing your default microphone in your
              system settings.
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="text-xs text-muted-foreground/70">
          <p>
            💡 <strong>Tip:</strong> When you select a microphone, the app will
            immediately switch to that device. You can verify by hovering over
            the microphone button in the main interface - it will show the
            active device name.
          </p>
        </div>
      </div>

      {/* System Audio Output Section */}
      <div className="space-y-3">
        <Header
          title="System Audio"
          description="Select the output device to capture system sounds and application audio. If issues occur, set the correct default output in OS settings."
        />

        <div className="space-y-3">
          {/* Output Selection Dropdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={selectedAudioDevices.output}
                onValueChange={(value) => handleDeviceChange("output", value)}
                disabled={isLoadingDevices || devices.output.length === 0}
              >
                <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <HeadphonesIcon className="size-4" />
                    <div className="text-sm font-medium truncate">
                      {isLoadingDevices
                        ? "Loading output devices..."
                        : devices.output.length === 0
                        ? "No output devices found"
                        : devices.output.find(
                            (output) =>
                              output.deviceId === selectedAudioDevices.output
                          )?.label || "Select an output device"}
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {devices.output.map((output) => (
                    <SelectItem key={output.deviceId} value={output.deviceId}>
                      <div className="flex items-center gap-2">
                        <HeadphonesIcon className="size-4" />
                        <div className="font-medium truncate">
                          {output.label}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Refresh button */}
              <Button
                size="icon"
                variant="outline"
                onClick={loadAudioDevices}
                disabled={isLoadingDevices}
                className="h-11 w-11 shrink-0"
                title="Refresh output device list"
              >
                <RefreshCwIcon
                  className={`size-4 ${isLoadingDevices ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Success message */}
          {showSuccess.output && (
            <div className="text-xs text-green-500 bg-green-500/10 p-3 rounded-md">
              <strong>✓ Output device changed successfully!</strong>
              <br />
              Using:{" "}
              {devices.output.find(
                (output) => output.deviceId === selectedAudioDevices.output
              )?.label || "Unknown device"}
            </div>
          )}

          {/* Permission Notice */}
          {devices.output.length === 0 && !isLoadingDevices && (
            <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-md">
              <strong>
                ⚠️ Click the refresh button to load your system audio devices.
              </strong>{" "}
              If this doesn't work, try changing your default system audio
              output in your system settings.
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="text-xs text-muted-foreground/70">
          <p>
            💡 <strong>Tip:</strong> System audio capture allows you to record
            audio playing through your speakers or headphones. This is useful
            for capturing conversation audio or system sounds along with your
            voice.
          </p>
        </div>
      </div>
    </div>
  );
};
