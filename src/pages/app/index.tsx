import { Toolbar } from "@/components/toolbar";
import { Updater, CustomCursor } from "@/components";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/store";
import { useCompletion, useQuickActions, useTTS } from "@/hooks";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/components/layouts";
import { getPlatform } from "@/lib";
import { useEffect } from "react";

const App = () => {
  const { isHidden } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();
  const completion = useCompletion();
  const quickActions = useQuickActions();
  const tts = useTTS();

  // Mark body transparent so body bg-background doesn't show behind the pill
  useEffect(() => {
    document.body.classList.add("transparent-window");
    return () => document.body.classList.remove("transparent-window");
  }, []);

  return (
    <ErrorBoundary
      fallbackRender={() => <ErrorLayout isCompact />}
      resetKeys={["app-error"]}
    >
      <div
        className={`w-screen h-screen flex overflow-visible justify-center items-center px-2 bg-transparent ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
      >
        <Toolbar
          completion={completion}
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
