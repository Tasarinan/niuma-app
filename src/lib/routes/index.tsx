import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  Dashboard,
  App,
  SystemPrompts,
  Settings,
  DevSpace,
  Shortcuts,
  Audio,
  Screenshot,
  AgentChat,
  Responses,
  CostTracking,
  ContextMemory,
  Speakers,
  Language,
} from "@/pages";
import { DashboardLayout } from "@/components/layouts";

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Full-bleed route — the standalone AgentChat window owns its own layout */}
        <Route path="/agent-chat" element={<AgentChat />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/system-prompts" element={<SystemPrompts />} />
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/screenshot" element={<Screenshot />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/responses" element={<Responses />} />
          <Route path="/cost-tracking" element={<CostTracking />} />
          <Route path="/context-memory" element={<ContextMemory />} />
          <Route path="/speakers" element={<Speakers />} />
          <Route path="/language" element={<Language />} />
          <Route path="/dev-space" element={<DevSpace />} />
        </Route>
      </Routes>
    </Router>
  );
}
