import { Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentCompletePage from './pages/PaymentCompletePage';

// NOTE: sellerId is hardcoded via a placeholder for now — wire up real
// auth (login -> JWT -> sellerId from token) before this goes beyond a demo.
const DEMO_SELLER_ID = 'replace-with-real-seller-id';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage sellerId={DEMO_SELLER_ID} />} />
      <Route path="/pay/:dealId" element={<CheckoutPage />} />
      <Route path="/pay/:dealId/complete" element={<PaymentCompletePage />} />
    </Routes>
  );
}
