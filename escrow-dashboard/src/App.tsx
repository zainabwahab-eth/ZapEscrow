import { Routes, Route, Navigate, type ReactElement } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/pay/:dealId" element={<CheckoutPage />} />
        <Route path="/pay/:dealId/complete" element={<PaymentCompletePage />} />
      </Routes>
    </AuthProvider>
  );
}
