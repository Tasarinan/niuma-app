import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  Dashboard,
  App,
  Settings,
  Shortcuts,
  Audio,
  Screenshot,
  AgentChat,
  Agents,
  Skills,
  Responses,
  CostTracking,
  ContextMemory,
  Speakers,
  Providers,
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
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/screenshot" element={<Screenshot />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/responses" element={<Responses />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/cost-tracking" element={<CostTracking />} />
          <Route path="/context-memory" element={<ContextMemory />} />
          <Route path="/speakers" element={<Speakers />} />
        </Route>
      </Routes>
    </Router>
  );
}
