import { useEffect, useMemo, useState } from 'react';
import { dealsApi, type Deal } from '../lib/api';
import { useAuth } from '../lib/auth';
import DealsTable from '../components/DealsTable';

export default function DealsPage() {
  const { seller } = useAuth();
  const sellerId = seller!.id;
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealsApi
      .listForSeller(sellerId, filter === 'All' ? undefined : filter)
      .then(setDeals)
      .finally(() => setLoading(false));
  }, [sellerId, filter]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter(
      (d) =>
        (d.buyerName ?? '').toLowerCase().includes(q) ||
        d.buyerPhone.toLowerCase().includes(q) ||
        d.shortCode.toLowerCase().includes(q),
    );
  }, [deals, search]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by buyer name, phone, or deal code…"
        className="w-full max-w-md px-4 py-2.5 rounded-lg border border-escrow-ink/15 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal text-sm"
      />

      {loading ? (
        <p className="text-escrow-ink/50">Loading…</p>
      ) : (
        <DealsTable deals={filteredDeals} activeFilter={filter} onFilterChange={setFilter} />
      )}
    </div>
  );
}
