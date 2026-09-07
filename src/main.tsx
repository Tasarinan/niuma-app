import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import Overlay from "./components/Overlay";
import { AppProvider, ThemeProvider } from "./components";
import { Toaster } from "./components";
import i18n from "./i18n";
import "./global.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppRoutes from "./lib/routes";
import AgentChat from "./pages/agents-chat";

const currentWindow = getCurrentWindow();
const windowLabel = currentWindow.label;

function RootErrorBoundary({ children }: { children: React.ReactNode }) {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const onUpdate = () => setResetKey((key) => key + 1);
    hot.on("vite:afterUpdate", onUpdate);
    return () => {
      hot.off("vite:afterUpdate", onUpdate);
    };
  }, []);

  return (
    <ErrorBoundary
      resetKeys={[resetKey]}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex h-screen w-screen flex-col gap-3 overflow-auto bg-background p-4 text-foreground">
          <p className="text-sm font-semibold text-destructive">
            页面渲染出错 / Render error
          </p>
          <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
            {String(error?.stack || error?.message || error)}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm text-white hover:bg-indigo-600"
              onClick={resetErrorBoundary}
            >
              重试
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

const renderWithProviders = (ui: React.ReactNode) =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AppProvider>
            <RootErrorBoundary>
              {ui}
            </RootErrorBoundary>
            <Toaster />
          </AppProvider>
        </ThemeProvider>
      </I18nextProvider>
    </React.StrictMode>
  );

// Render different components based on window label
if (windowLabel.startsWith("capture-overlay-")) {
  const monitorIndex = parseInt(windowLabel.split("-")[2], 10) || 0;
  // Render overlay without providers
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Overlay monitorIndex={monitorIndex} />
    </React.StrictMode>
  );
} else if (windowLabel === "agent-chat") {
  // Render AgentChat as a first-class window (same level as dashboard, not overlay)
  renderWithProviders(<AgentChat />);
} else {
  renderWithProviders(<AppRoutes />);
}
