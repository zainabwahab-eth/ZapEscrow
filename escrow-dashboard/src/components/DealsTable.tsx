import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { dealsApi, type Deal } from '../lib/api';
import StatusPill from './StatusPill';

const FILTERS = ['All', 'CREATED', 'PAID', 'SHIPPED', 'DISPUTED', 'RELEASED', 'REFUNDED'];

type SortMode = 'created' | 'paid';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DealsTable({
  deals,
  activeFilter,
  onFilterChange,
  hideFilters = false,
}: {
  deals: Deal[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  hideFilters?: boolean;
}) {
  const [localDeals, setLocalDeals] = useState(deals);
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [shipModalDeal, setShipModalDeal] = useState<Deal | null>(null);
  const [shipEta, setShipEta] = useState('');
  const [shipSubmitting, setShipSubmitting] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  useEffect(() => {
    setLocalDeals(deals);
  }, [deals]);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-deal-menu]')) setOpenMenuId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const sortedDeals = useMemo(() => {
    const copy = [...localDeals];
    if (sortMode === 'paid') {
      copy.sort((a, b) => {
        const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bTime - aTime;
      });
    } else {
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return copy;
  }, [localDeals, sortMode]);

  function openShipModal(deal: Deal) {
    setShipModalDeal(deal);
    setShipEta(deal.estimatedDeliveryDate ? deal.estimatedDeliveryDate.slice(0, 10) : '');
    setShipError(null);
    setOpenMenuId(null);
  }

  async function handleShipSubmit() {
    if (!shipModalDeal) return;
    setShipError(null);
    setShipSubmitting(true);
    try {
      const updated = await dealsApi.markShipped(
        shipModalDeal.id,
        shipEta ? new Date(shipEta).toISOString() : undefined,
      );
      setLocalDeals((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setShipModalDeal(null);
    } catch {
      setShipError("Couldn't save that — please try again.");
    } finally {
      setShipSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {!hideFilters && activeFilter !== undefined && onFilterChange && (
        <div className="flex items-center justify-between gap-4 p-4 border-b overflow-x-auto">
          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => onFilterChange(filter)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                  activeFilter === filter
                    ? 'bg-escrow-teal text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
            <ArrowUpDown size={14} strokeWidth={1.75} />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="created">Recently created</option>
              <option value="paid">Recently paid</option>
            </select>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="p-4 font-medium">Code</th>
            <th className="p-4 font-medium">Buyer</th>
            <th className="p-4 font-medium">Items</th>
            <th className="p-4 font-medium">Amount</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Created</th>
            <th className="p-4 font-medium">Releases</th>
            <th className="p-4 font-medium w-10" />
          </tr>
        </thead>
        <tbody>
          {sortedDeals.map((deal) => (
            <tr key={deal.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-4 font-mono text-xs text-gray-500">{deal.shortCode}</td>
              <td className="p-4">{deal.buyerName || deal.buyerPhone}</td>
              <td className="p-4 text-gray-600">{deal.items.map((i) => i.name).join(', ')}</td>
              <td className="p-4 font-medium">₦{Number(deal.amount).toLocaleString()}</td>
              <td className="p-4">
                <StatusPill status={deal.status} />
              </td>
              <td className="p-4 text-gray-500">{formatDate(deal.createdAt)}</td>
              <td className="p-4 text-gray-500">{formatDate(deal.autoReleaseDeadline)}</td>
              <td className="p-4 relative">
                {(deal.status === 'PAID' || deal.status === 'SHIPPED') && (
                  <div data-deal-menu className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === deal.id ? null : deal.id)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                      aria-label="Deal actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openMenuId === deal.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => openShipModal(deal)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-lg"
                        >
                          {deal.status === 'PAID' ? 'Add shipment' : 'Update shipment'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {sortedDeals.length === 0 && (
            <tr>
              <td colSpan={8} className="p-8 text-center text-gray-400">
                No deals here yet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {shipModalDeal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
          onClick={() => setShipModalDeal(null)}
        >
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-fraunces text-xl mb-1">
              {shipModalDeal.status === 'PAID' ? 'Add shipment' : 'Update shipment'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{shipModalDeal.shortCode}</p>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated delivery date</label>
            <input
              type="date"
              value={shipEta}
              onChange={(e) => setShipEta(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-escrow-teal mb-4"
            />

            {shipError && <p className="text-sm text-escrow-coral mb-3">{shipError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleShipSubmit}
                disabled={shipSubmitting}
                className="px-5 py-2 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {shipSubmitting ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setShipModalDeal(null)}
                className="text-sm text-gray-500 hover:text-gray-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
