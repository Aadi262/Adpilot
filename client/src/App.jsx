import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from './components/ui/Toast';

// ─── Lazy page imports ────────────────────────────────────────────────────────
const LandingPage       = lazy(() => import('./pages/LandingPage'));
const LoginPage         = lazy(() => import('./pages/LoginPage'));
const RegisterPage      = lazy(() => import('./pages/RegisterPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const CampaignsPage     = lazy(() => import('./pages/CampaignsPage'));
const AnalyticsPage     = lazy(() => import('./pages/AnalyticsPage'));
const SeoPage           = lazy(() => import('./pages/SeoPage'));
const RulesPage         = lazy(() => import('./pages/RulesPage'));
const IntegrationsPage  = lazy(() => import('./pages/IntegrationsPage'));
const TeamPage          = lazy(() => import('./pages/TeamPage'));
const SettingsPage      = lazy(() => import('./pages/SettingsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const AdStudioPage      = lazy(() => import('./pages/AdStudioPage'));
const ResearchPage      = lazy(() => import('./pages/ResearchPage'));
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage'));
const AcceptInvitePage        = lazy(() => import('./pages/AcceptInvitePage'));
const BudgetProtectionPage    = lazy(() => import('./pages/BudgetProtectionPage'));
const CompetitorHijackPage    = lazy(() => import('./pages/CompetitorHijackPage'));
const ScalingPredictorPage    = lazy(() => import('./pages/ScalingPredictorPage'));

// ─── Loading spinner ──────────────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Offline banner ───────────────────────────────────────────────────────────
function OfflineBanner() {
  const { warning } = useToast();
  useEffect(() => {
    const handleOffline = () => warning('You are offline. Some features may not work.', { duration: 0 });
    const handleOnline  = () => window.location.reload();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, [warning]);
  return null;
}

// ─── Server error listener ────────────────────────────────────────────────────
function ServerErrorListener() {
  const { error } = useToast();
  useEffect(() => {
    const handler = (e) => error(e.detail?.message || 'Server error. Please try again.');
    window.addEventListener('api:server-error', handler);
    return () => window.removeEventListener('api:server-error', handler);
  }, [error]);
  return null;
}

// ─── Route guards ─────────────────────────────────────────────────────────────
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <OfflineBanner />
      <ServerErrorListener />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />

          {/* Public */}
          <Route path="/login"         element={<PublicRoute><ErrorBoundary><LoginPage /></ErrorBoundary></PublicRoute>} />
          <Route path="/register"      element={<PublicRoute><ErrorBoundary><RegisterPage /></ErrorBoundary></PublicRoute>} />
          <Route path="/accept-invite" element={<ErrorBoundary><AcceptInvitePage /></ErrorBoundary>} />

          {/* Protected inside AppLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard"     element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="campaigns"     element={<ErrorBoundary><CampaignsPage /></ErrorBoundary>} />
            <Route path="analytics"     element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
            <Route path="seo"           element={<ErrorBoundary><SeoPage /></ErrorBoundary>} />
            <Route path="rules"         element={<ErrorBoundary><RulesPage /></ErrorBoundary>} />
            <Route path="integrations"  element={<ErrorBoundary><IntegrationsPage /></ErrorBoundary>} />
            <Route path="team"          element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />
            <Route path="settings"      element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            <Route path="notifications" element={<ErrorBoundary><NotificationsPage /></ErrorBoundary>} />
            <Route path="ads"               element={<ErrorBoundary><AdStudioPage /></ErrorBoundary>} />
            <Route path="research"          element={<ErrorBoundary><ResearchPage /></ErrorBoundary>} />
            <Route path="budget-ai"         element={<ErrorBoundary><BudgetProtectionPage /></ErrorBoundary>} />
            <Route path="competitor-hijack" element={<ErrorBoundary><CompetitorHijackPage /></ErrorBoundary>} />
            <Route path="scaling"           element={<ErrorBoundary><ScalingPredictorPage /></ErrorBoundary>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<ErrorBoundary><NotFoundPage /></ErrorBoundary>} />
        </Routes>
      </Suspense>
    </>
  );
}
