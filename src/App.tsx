import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Explorer from "@/pages/Explorer";
import Ingest from "@/pages/Ingest";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// P2-4: 路由级 ErrorBoundary，单页崩溃不崩全站导航
const RouteBoundary = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<RouteBoundary><Dashboard /></RouteBoundary>} />
          <Route path="/explorer" element={<RouteBoundary><Explorer /></RouteBoundary>} />
          <Route path="/ingest" element={<RouteBoundary><Ingest /></RouteBoundary>} />
          <Route path="/settings" element={<RouteBoundary><Settings /></RouteBoundary>} />
          <Route path="/help" element={<RouteBoundary><Help /></RouteBoundary>} />
          <Route path="/privacy" element={<RouteBoundary><PrivacyPolicy /></RouteBoundary>} />
          <Route path="/terms" element={<RouteBoundary><TermsOfService /></RouteBoundary>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
