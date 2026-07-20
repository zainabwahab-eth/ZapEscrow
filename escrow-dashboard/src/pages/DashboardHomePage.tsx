import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { dealsApi, type Deal, type SellerTotals } from '../lib/api';
import { useAuth } from '../lib/auth';
import TotalsCards from '../components/TotalsCards';
import DealsTable from '../components/DealsTable';

const STATUS_ORDER = ['PAID', 'SHIPPED', 'DISPUTED', 'RELEASED', 'REFUNDED'];

export default function DashboardHomePage() {
  const { seller } = useAuth();
  const sellerId = seller!.id;
  const [totals, setTotals] = useState<SellerTotals | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dealsApi.getTotals(sellerId), dealsApi.listForSeller(sellerId)])
      .then(([totalsRes, dealsRes]) => {
        setTotals(totalsRes);
        setDeals(dealsRes);
      })
      .finally(() => setLoading(false));
  }, [sellerId]);

  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deal of deals) {
      counts.set(deal.status, (counts.get(deal.status) ?? 0) + 1);
    }
    return STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  }, [deals]);

  const recentDeals = deals.slice(0, 5);

  if (loading) return <p className="text-escrow-ink/50">Loading…</p>;
  if (!totals) return null;

  return (
    <div className="space-y-8">
      <TotalsCards totals={totals} />

      <div className="bg-white rounded-xl border border-escrow-ink/10 p-6">
        <p className="font-mono text-xs tracking-widest text-escrow-ink/40 uppercase mb-4">Deals by status</p>
        {deals.length === 0 ? (
          <p className="text-sm text-escrow-ink/50 py-8 text-center">
            No deals yet — they'll show up here once you start selling.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21201d1a" />
              <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#21201d99' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#21201d99' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: '#0F766E0d' }} contentStyle={{ borderRadius: 8, border: '1px solid #21201d1a', fontSize: 13 }} />
              <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs tracking-widest text-escrow-ink/40 uppercase">Recent deals</p>
          <Link to="/deals" className="text-sm text-escrow-teal font-medium hover:underline">
            View all →
          </Link>
        </div>
        <DealsTable deals={recentDeals} hideFilters />
      </div>
    </div>
  );
}
