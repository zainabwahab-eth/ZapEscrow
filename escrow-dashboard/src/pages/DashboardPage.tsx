import { useEffect, useState } from 'react';
import { dealsApi, type Deal, type SellerTotals } from '../lib/api';
import { useAuth } from '../lib/auth';
import TotalsCards from '../components/TotalsCards';
import DealsTable from '../components/DealsTable';

export default function DashboardPage() {
  const { seller } = useAuth();
  const sellerId = seller!.id; // ProtectedRoute guarantees an authenticated seller before this renders
  const [totals, setTotals] = useState<SellerTotals | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dealsApi.getTotals(sellerId),
      dealsApi.listForSeller(sellerId, filter === 'All' ? undefined : filter),
    ])
      .then(([totalsRes, dealsRes]) => {
        setTotals(totalsRes);
        setDeals(dealsRes);
      })
      .finally(() => setLoading(false));
  }, [sellerId, filter]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Escrow Dashboard</h1>
        <p className="text-gray-500 mt-1">Track every deal, from payment to release.</p>
      </header>

      {loading && <p className="text-gray-400">Loading…</p>}

      {!loading && totals && (
        <div className="space-y-6">
          <TotalsCards totals={totals} />
          <DealsTable deals={deals} activeFilter={filter} onFilterChange={setFilter} />
        </div>
      )}
    </div>
  );
}
