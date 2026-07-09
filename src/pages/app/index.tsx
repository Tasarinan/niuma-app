import { Toolbar } from "@/components/toolbar";
import { Updater, CustomCursor } from "@/components";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { useCompletion, useQuickActions, useTimer, useTTS } from "@/hooks";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";

const App = () => {
  const { isHidden } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();
  const completion = useCompletion();
  const quickActions = useQuickActions();
  const timer = useTimer();
  const tts = useTTS();

  return (
    <ErrorBoundary
      fallbackRender={() => <ErrorLayout isCompact />}
      resetKeys={["app-error"]}
    >
      <div
        className={`w-screen h-screen flex overflow-visible justify-center items-start p-2 ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
      >
        <Toolbar
          completion={completion}
          timer={timer}
          tts={tts}
          quickActions={quickActions}
          isHidden={isHidden}
        />
        <Updater />
        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;
