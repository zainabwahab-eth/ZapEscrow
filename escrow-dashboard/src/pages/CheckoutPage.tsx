import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicDealApi, type PublicDeal } from '../lib/api';

export default function CheckoutPage() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<PublicDeal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    publicDealApi.get(dealId).then(setDeal).finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading…</div>;
  if (!deal) return <div className="p-10 text-center text-gray-400">Deal not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <p className="text-sm text-gray-500">Order from</p>
          <p className="font-semibold text-gray-900">
            {deal.sellerName} {deal.sellerVerified && <span className="text-escrow-teal text-xs ml-1">✓ Verified</span>}
          </p>
        </div>

        <div className="space-y-3">
          {deal.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">Qty {item.quantity} · ₦{Number(item.unitPrice).toLocaleString()} each</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t pt-4">
          <span className="text-gray-500">Total</span>
          <span className="text-xl font-semibold text-gray-900">₦{Number(deal.amount).toLocaleString()}</span>
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 text-sm text-teal-800">
          🔒 Your money is held in escrow, not sent to the seller directly. Once you confirm you've received your order, funds are released. If something's wrong, you can get your money back.
        </div>

        <a
          href={deal.checkoutUrl}
          className="block w-full text-center bg-escrow-teal text-white font-medium py-3 rounded-lg hover:opacity-90 transition"
        >
          Make Payment
        </a>
      </div>
    </div>
  );
}
