import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Clock, Package, CheckCircle2, AlertTriangle } from 'lucide-react';
import { publicDealApi, type PublicDeal } from '../lib/api';
import CornerMarks from '../components/CornerMarks';
import BookmarkCallout from '../components/BookmarkCallout';

const POLL_INTERVAL_MS = 20000;

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex justify-center px-6 py-12 md:py-20">
      <div className="max-w-lg w-full">{children}</div>
    </div>
  );
}

export default function CheckoutPage() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<PublicDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!dealId) return;
    publicDealApi
      .get(dealId)
      .then((d) => {
        setDeal(d);
        setError(null);
      })
      .catch((err) => {
        setError(
          err?.response?.status === 404
            ? 'Deal not found'
            : "Couldn't reach the server — please check your connection and try again.",
        );
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  // Revisiting this link should always reflect current status — refetch
  // periodically in case the seller ships or a dispute gets resolved while
  // this tab is open.
  useEffect(() => {
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleConfirm() {
    if (!dealId) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      await publicDealApi.confirm(dealId);
      load();
    } catch {
      setConfirmError("Couldn't confirm receipt — please try again.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleSubmitDispute() {
    if (!dealId || !disputeReason.trim()) return;
    setDisputeError(null);
    setDisputeSubmitting(true);
    try {
      await publicDealApi.dispute(dealId, disputeReason.trim());
      setReportingIssue(false);
      load();
    } catch {
      setDisputeError("Couldn't submit that — please try again.");
    } finally {
      setDisputeSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-escrow-ink/50 text-center">Loading…</p>
      </Shell>
    );
  }

  if (error || !deal) {
    return (
      <Shell>
        <p className="text-escrow-ink/50 text-center">{error ?? 'Deal not found'}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <Lock size={14} strokeWidth={2} className="text-escrow-teal" />
        <p className="font-mono text-xs tracking-widest text-escrow-teal uppercase">Secure order</p>
      </div>

      <div className="relative border border-escrow-ink/15 bg-white p-6 md:p-8 space-y-6">
        <CornerMarks />

        <div>
          <p className="text-sm text-escrow-ink/50">Order from</p>
          <h1 className="font-fraunces text-2xl mt-0.5">
            {deal.sellerName}
            {deal.sellerVerified && <span className="text-escrow-teal text-sm font-sans font-medium ml-2">✓ Verified</span>}
          </h1>
        </div>

        {(deal.buyerName || deal.buyerPhone || deal.buyerEmail) && (
          <div className="text-sm text-escrow-ink/70 space-y-0.5 border-t border-escrow-ink/10 pt-4">
            {deal.buyerName && <p>{deal.buyerName}</p>}
            {deal.buyerPhone && <p>{deal.buyerPhone}</p>}
            {deal.buyerEmail && <p>{deal.buyerEmail}</p>}
          </div>
        )}

        <div className="space-y-3 border-t border-escrow-ink/10 pt-4">
          {deal.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded-lg object-cover bg-escrow-cream border border-escrow-ink/10"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-escrow-ink">{item.name}</p>
                <p className="text-xs text-escrow-ink/50">
                  Qty {item.quantity} · ₦{Number(item.unitPrice).toLocaleString()} each
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-escrow-ink/10 pt-4">
          <span className="text-escrow-ink/60">Total</span>
          <span className="text-xl font-fraunces">₦{Number(deal.amount).toLocaleString()}</span>
        </div>

        <div className="border-t border-escrow-ink/10 pt-6">
          {deal.status === 'CREATED' && (
            <div className="space-y-4">
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                Your money is held in escrow, not sent to the seller directly. Once you confirm you've received your
                order, funds are released. If something's wrong, you can get your money back.
              </p>
              <a
                href={deal.checkoutUrl}
                className="block w-full text-center bg-escrow-teal text-white font-medium py-3 rounded-full hover:opacity-90 transition"
              >
                Make Payment
              </a>
            </div>
          )}

          {deal.status === 'PAID' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-escrow-teal">
                <Clock size={16} strokeWidth={2} />
                <p className="text-sm font-medium">Payment received — held in escrow</p>
              </div>
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                Your money is safe. We'll let you know as soon as {deal.sellerName} ships your order.
              </p>
              <BookmarkCallout />
            </div>
          )}

          {deal.status === 'SHIPPED' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-escrow-teal">
                <Package size={16} strokeWidth={2} />
                <p className="text-sm font-medium">
                  Shipped{formatDate(deal.estimatedDeliveryDate) ? ` — expected ${formatDate(deal.estimatedDeliveryDate)}` : ''}
                </p>
              </div>
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                Received your order? Confirm below to release payment to the seller. If there's a problem, let us
                know instead of confirming.
                {formatDate(deal.autoReleaseDeadline) &&
                  ` If we don't hear from you by ${formatDate(deal.autoReleaseDeadline)}, payment releases automatically.`}
              </p>

              {!reportingIssue && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex-1 bg-escrow-teal text-white font-medium py-3 rounded-full hover:opacity-90 transition disabled:opacity-50"
                  >
                    {confirming ? 'Confirming…' : 'Confirm receipt'}
                  </button>
                  <button
                    onClick={() => setReportingIssue(true)}
                    className="flex-1 border border-escrow-ink/20 text-escrow-ink font-medium py-3 rounded-full hover:border-escrow-ink/40 transition"
                  >
                    Report a problem
                  </button>
                </div>
              )}
              {confirmError && <p className="text-sm text-escrow-coral">{confirmError}</p>}

              {reportingIssue && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-escrow-ink/70">What went wrong?</label>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal resize-none"
                    placeholder="Tell us what happened…"
                  />
                  {disputeError && <p className="text-sm text-escrow-coral">{disputeError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmitDispute}
                      disabled={disputeSubmitting || !disputeReason.trim()}
                      className="flex-1 bg-escrow-coral text-white font-medium py-2.5 rounded-full hover:opacity-90 transition disabled:opacity-50"
                    >
                      {disputeSubmitting ? 'Submitting…' : 'Submit'}
                    </button>
                    <button
                      onClick={() => {
                        setReportingIssue(false);
                        setDisputeError(null);
                      }}
                      className="text-sm text-escrow-ink/50 hover:text-escrow-ink transition px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {deal.status === 'DISPUTED' && (
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} strokeWidth={2} className="text-escrow-coral shrink-0 mt-0.5" />
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                <span className="font-medium text-escrow-ink">We're reviewing this.</span> Your report has been
                sent to the seller and our team. Payment stays held in escrow until this is resolved.
              </p>
            </div>
          )}

          {deal.status === 'DELIVERED' && (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} strokeWidth={2} className="text-escrow-teal shrink-0 mt-0.5" />
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                Thanks for confirming — payment is being released to {deal.sellerName}.
              </p>
            </div>
          )}

          {(deal.status === 'RELEASED' || deal.status === 'AUTO_RELEASED') && (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} strokeWidth={2} className="text-escrow-teal shrink-0 mt-0.5" />
              <p className="text-sm text-escrow-ink/70 leading-relaxed">
                <span className="font-medium text-escrow-ink">Order complete.</span> Payment has been released to{' '}
                {deal.sellerName}.
              </p>
            </div>
          )}

          {deal.status === 'REFUNDED' && (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} strokeWidth={2} className="text-escrow-ink/50 shrink-0 mt-0.5" />
              <p className="text-sm text-escrow-ink/70 leading-relaxed">This order was refunded to you.</p>
            </div>
          )}

          {deal.status === 'EXPIRED' && (
            <p className="text-sm text-escrow-ink/50">This payment link has expired.</p>
          )}
        </div>
      </div>
    </Shell>
  );
}
