import { Routes, Route, Navigate, type ReactElement } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import DashboardLayout from './components/DashboardLayout';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardHomePage from './pages/DashboardHomePage';
import DealsPage from './pages/DealsPage';
import NewDealPage from './pages/NewDealPage';
import DisputesPage from './pages/DisputesPage';
import InvoicingPage from './pages/InvoicingPage';
import SettingsPage from './pages/SettingsPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentCompletePage from './pages/PaymentCompletePage';

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardHomePage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/new" element={<NewDealPage />} />
          <Route path="/disputes" element={<DisputesPage />} />
          <Route path="/invoicing" element={<InvoicingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/pay/:dealId" element={<CheckoutPage />} />
        <Route path="/pay/:dealId/complete" element={<PaymentCompletePage />} />
      </Routes>
    </AuthProvider>
  );
}
