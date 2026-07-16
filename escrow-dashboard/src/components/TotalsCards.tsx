import type { SellerTotals } from '../lib/api';

function formatNaira(value: string) {
  return `₦${Number(value).toLocaleString()}`;
}

export default function TotalsCards({ totals }: { totals: SellerTotals }) {
  const cards = [
    { label: 'Currently in escrow', value: totals.totalInEscrow, accent: 'border-escrow-teal' },
    { label: 'Released to you', value: totals.totalReleased, accent: 'border-emerald-500' },
    { label: 'Refunded to buyers', value: totals.totalRefunded, accent: 'border-purple-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border-l-4 ${card.accent} bg-white shadow-sm p-5`}>
          <p className="text-sm text-gray-500">{card.label}</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNaira(card.value)}</p>
        </div>
      ))}
    </div>
  );
}
