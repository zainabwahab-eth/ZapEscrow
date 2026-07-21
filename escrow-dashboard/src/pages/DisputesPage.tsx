import { useEffect, useState } from 'react';
import { dealsApi, type DisputedDeal } from '../lib/api';
import { useAuth } from '../lib/auth';
import CornerMarks from '../components/CornerMarks';

export default function DisputesPage() {
  const { seller } = useAuth();
  const isAdmin = seller?.isAdmin ?? false;
  const [disputes, setDisputes] = useState<DisputedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    dealsApi
      .listDisputes()
      .then(setDisputes)
      .finally(() => setLoading(false));
  }

  async function handleResolve(dealId: string, resolution: 'RELEASED' | 'REFUNDED') {
    setError(null);
    setResolvingId(dealId);
    try {
      await dealsApi.resolveDispute(dealId, resolution);
      setDisputes((prev) => prev.filter((d) => d.id !== dealId));
    } catch {
      setError("Couldn't resolve that dispute — please try again.");
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <p className="text-escrow-ink/50">Loading…</p>;

  if (disputes.length === 0) {
    return (
      <div className="relative border border-escrow-ink/15 bg-white p-10 max-w-md mx-auto text-center mt-10">
        <CornerMarks />
        <p className="font-mono text-xs tracking-widest text-escrow-teal uppercase mb-3">All clear</p>
        <h2 className="font-fraunces text-2xl">No disputes right now</h2>
        <p className="mt-3 text-sm text-escrow-ink/60">Disputed deals will show up here for you to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {error && <p className="text-sm text-escrow-coral">{error}</p>}

      {disputes.map((deal) =>
        isAdmin ? (
          <div key={deal.id} className="bg-white rounded-xl border border-escrow-ink/10 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-escrow-ink/40">{deal.shortCode}</p>
                <p className="font-medium text-escrow-ink mt-0.5">{deal.buyerName || deal.buyerPhone}</p>
                <p className="text-sm text-escrow-ink/50">Seller: {deal.seller.businessName}</p>
              </div>
              <p className="text-lg font-fraunces">₦{Number(deal.amount).toLocaleString()}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 border-t border-escrow-ink/10 pt-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-escrow-ink/40 mb-1.5">Buyer's report</p>
                <p className="text-sm text-escrow-ink/80 leading-relaxed">{deal.dispute?.reason ?? 'No reason given'}</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-escrow-ink/40 mb-1.5">Seller's response</p>
                <p className="text-sm text-escrow-ink/60 leading-relaxed">
                  {deal.dispute?.sellerResponse ?? 'No response yet'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-escrow-ink/10 pt-4">
              <button
                onClick={() => handleResolve(deal.id, 'RELEASED')}
                disabled={resolvingId === deal.id}
                className="px-4 py-2 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                Release to seller
              </button>
              <button
                onClick={() => handleResolve(deal.id, 'REFUNDED')}
                disabled={resolvingId === deal.id}
                className="px-4 py-2 rounded-full border border-escrow-ink/20 text-sm font-medium hover:border-escrow-ink/40 transition disabled:opacity-50"
              >
                Refund buyer
              </button>
            </div>
          </div>
        ) : (
          <div key={deal.id} className="bg-white rounded-xl border border-escrow-ink/10 p-6">
            <p className="text-sm text-escrow-ink/80 leading-relaxed">
              Dispute raised on <span className="font-mono">{deal.shortCode}</span>. Reason:{' '}
              {deal.dispute?.reason ?? 'No reason given'}. Status:{' '}
              <span className="font-medium text-escrow-ink">Under review by ZapEscrow.</span>
            </p>
          </div>
        ),
      )}
    </div>
  );
}
