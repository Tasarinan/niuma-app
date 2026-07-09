import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import Overlay from "./components/Overlay";
import { AppProvider, ThemeProvider } from "./contexts";
import { Toaster } from "./components";
import i18n from "./i18n";
import "./global.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppRoutes from "./routes";

const currentWindow = getCurrentWindow();
const windowLabel = currentWindow.label;

// Render different components based on window label
if (windowLabel.startsWith("capture-overlay-")) {
  const monitorIndex = parseInt(windowLabel.split("-")[2], 10) || 0;
  // Render overlay without providers
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Overlay monitorIndex={monitorIndex} />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AppProvider>
            <AppRoutes />
            <Toaster />
          </AppProvider>
        </ThemeProvider>
      </I18nextProvider>
    </React.StrictMode>
  );
}
