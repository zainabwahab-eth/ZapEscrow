import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { publicDealApi, type PublicDeal } from '../lib/api';
import CornerMarks from '../components/CornerMarks';
import BookmarkCallout from '../components/BookmarkCallout';

export default function PaymentCompletePage() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<PublicDeal | null>(null);

  useEffect(() => {
    if (!dealId) return;
    publicDealApi.get(dealId).then(setDeal).catch(() => {});
  }, [dealId]);

  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex justify-center px-6 py-12 md:py-20">
      <div className="max-w-lg w-full">
        <div className="relative border border-escrow-ink/15 bg-white p-6 md:p-8 space-y-6 text-center">
          <CornerMarks />

          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 size={32} strokeWidth={1.75} className="text-escrow-teal" />
            <h1 className="font-fraunces text-2xl">Payment received</h1>
          </div>

          <p className="text-sm text-escrow-ink/70 leading-relaxed">
            Your money is safely held in escrow{deal ? ` for your order from ${deal.sellerName}` : ''}. You'll get a
            message once your order ships, and you can confirm receipt then to release payment to the seller.
          </p>

          <div className="text-left">
            <BookmarkCallout />
          </div>

          {dealId && (
            <Link
              to={`/pay/${dealId}`}
              className="inline-block text-sm text-escrow-teal font-medium hover:underline"
            >
              View order status →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
