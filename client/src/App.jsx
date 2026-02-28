import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CampaignsPage from './pages/CampaignsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SeoPage from './pages/SeoPage';
import RulesPage from './pages/RulesPage';
import IntegrationsPage from './pages/IntegrationsPage';
import TeamPage from './pages/TeamPage';
import NotFoundPage from './pages/NotFoundPage';
import ComingSoon from './pages/ComingSoon';
import AcceptInvitePage from './pages/AcceptInvitePage';

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public routes */}
      <Route path="/login"          element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"       element={<PublicRoute><RegisterPage /></PublicRoute>} />
      {/* Accept invite is always public — token in URL proves identity */}
      <Route path="/accept-invite"  element={<AcceptInvitePage />} />

      {/* Protected routes inside AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="campaigns"    element={<CampaignsPage />} />
        <Route path="analytics"    element={<AnalyticsPage />} />
        <Route path="seo"          element={<SeoPage />} />
        <Route path="rules"        element={<RulesPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="team"         element={<TeamPage />} />
        <Route path="ads"          element={<ComingSoon title="Ad Studio" />} />
        <Route path="research"     element={<ComingSoon title="Research Hub" />} />
        <Route path="settings"     element={<ComingSoon title="Settings" />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
