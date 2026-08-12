import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { publicDealApi, type PublicDeal } from '../lib/api';
import CornerMarks from '../components/CornerMarks';
import BookmarkCallout from '../components/BookmarkCallout';

export default function PaymentCompletePage() {
  const { dealId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
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

          <div className="text-left space-y-3">
            <BookmarkCallout />

            {token && (
              <div className="border border-escrow-coral/40 bg-escrow-coral/5 rounded-lg p-4 flex gap-3">
                <ShieldAlert size={18} strokeWidth={1.75} className="text-escrow-coral shrink-0 mt-0.5" />
                <p className="text-sm text-escrow-ink/80 leading-relaxed">
                  <span className="font-medium text-escrow-ink">This link is yours alone</span> — it's how you'll
                  confirm you received your order. Don't share it with anyone, including the seller. Bookmark it now
                  so you can find it again when your order arrives.
                </p>
              </div>
            )}
          </div>

          {dealId && (
            <Link
              to={token ? `/pay/${dealId}?token=${token}` : `/pay/${dealId}`}
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
