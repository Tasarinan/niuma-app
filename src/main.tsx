import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import Overlay from "./components/Overlay";
import { AppProvider, ThemeProvider } from "./components";
import { Toaster } from "./components";
import i18n from "./lib/i18n";
import "./global.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppRoutes from "./lib/routes";
import AgentChat from "./pages/agents-chat";

const currentWindow = getCurrentWindow();
const windowLabel = currentWindow.label;

const renderWithProviders = (ui: React.ReactNode) =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AppProvider>
            <ErrorBoundary
              fallbackRender={({ error }) => (
                <div className="flex h-screen w-screen flex-col gap-2 overflow-auto bg-background p-4 text-foreground">
                  <p className="text-sm font-semibold text-destructive">
                    页面渲染出错 / Render error
                  </p>
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                    {String(error?.stack || error?.message || error)}
                  </pre>
                </div>
              )}
            >
              {ui}
            </ErrorBoundary>
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
