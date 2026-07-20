import type { Deal } from '../lib/api';
import StatusPill from './StatusPill';

const FILTERS = ['All', 'CREATED', 'PAID', 'SHIPPED', 'DISPUTED', 'RELEASED', 'REFUNDED'];

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
  return (
    <div className="bg-white rounded-xl shadow-sm">
      {!hideFilters && activeFilter !== undefined && onFilterChange && (
        <div className="flex gap-2 p-4 border-b overflow-x-auto">
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
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-4 font-mono text-xs text-gray-500">{deal.shortCode}</td>
              <td className="p-4">{deal.buyerName || deal.buyerPhone}</td>
              <td className="p-4 text-gray-600">
                {deal.items.map((i) => i.name).join(', ')}
              </td>
              <td className="p-4 font-medium">₦{Number(deal.amount).toLocaleString()}</td>
              <td className="p-4">
                <StatusPill status={deal.status} />
              </td>
              <td className="p-4 text-gray-500">
                {new Date(deal.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {deals.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-400">
                No deals here yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
