import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, X, Plus, Copy, Check } from 'lucide-react';
import { dealsApi, storageApi, type Deal } from '../lib/api';
import { useAuth } from '../lib/auth';
import CornerMarks from '../components/CornerMarks';

type Step = 'buyer' | 'items' | 'review' | 'success';

interface ItemDraft {
  name: string;
  unitPrice: string;
  quantity: string;
  imageUrl?: string;
  uploading?: boolean;
}

function emptyItem(): ItemDraft {
  return { name: '', unitPrice: '', quantity: '1' };
}

function StepIndicator({ step }: { step: 'buyer' | 'items' }) {
  return (
    <div className="flex items-center gap-2 mb-8 font-mono text-xs tracking-widest uppercase">
      <span className={step === 'buyer' ? 'text-escrow-teal' : 'text-escrow-ink/40'}>1. Buyer</span>
      <span className="text-escrow-ink/20">—</span>
      <span className={step === 'items' ? 'text-escrow-teal' : 'text-escrow-ink/40'}>2. Items</span>
    </div>
  );
}

export default function NewDealPage() {
  const { seller } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('buyer');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdDeal, setCreatedDeal] = useState<Deal | null>(null);
  const [copied, setCopied] = useState(false);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImageUpload(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    updateItem(index, { uploading: true });
    try {
      const { url } = await storageApi.upload(file);
      updateItem(index, { imageUrl: url, uploading: false });
    } catch {
      updateItem(index, { uploading: false });
    }
  }

  const total = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  const itemsValid = items.every((it) => it.name.trim() && Number(it.unitPrice) > 0 && Number(it.quantity) >= 1);

  function handleBuyerNext(e: FormEvent) {
    e.preventDefault();
    if (!buyerPhone.trim()) return;
    setStep('items');
  }

  function handleItemsNext(e: FormEvent) {
    e.preventDefault();
    if (!itemsValid) return;
    setStep('review');
  }

  async function handleCreate() {
    if (!seller) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const deal = await dealsApi.create({
        sellerId: seller.id,
        buyerName: buyerName.trim() || undefined,
        buyerPhone: buyerPhone.trim(),
        buyerEmail: buyerEmail.trim() || undefined,
        items: items.map((it) => ({
          name: it.name.trim(),
          unitPrice: Number(it.unitPrice),
          quantity: Number(it.quantity),
          imageUrl: it.imageUrl,
        })),
      });
      setCreatedDeal(deal);
      setStep('success');
    } catch {
      setSubmitError("Couldn't create this deal — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyLink() {
    if (!createdDeal?.checkoutUrl) return;
    navigator.clipboard.writeText(createdDeal.checkoutUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreateAnother() {
    setBuyerName('');
    setBuyerPhone('');
    setBuyerEmail('');
    setItems([emptyItem()]);
    setCreatedDeal(null);
    setStep('buyer');
  }

  return (
    <div className="max-w-xl">
      {(step === 'buyer' || step === 'items') && <StepIndicator step={step} />}

      {step === 'buyer' && (
        <form onSubmit={handleBuyerNext} className="space-y-5">
          <h2 className="font-fraunces text-2xl mb-2">Who's this deal for?</h2>
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Buyer name</label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              placeholder="Musa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Phone number</label>
            <input
              type="tel"
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              placeholder="08012345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              placeholder="musa@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={!buyerPhone.trim()}
            className="px-6 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            Next
          </button>
        </form>
      )}

      {step === 'items' && (
        <form onSubmit={handleItemsNext} className="space-y-5">
          <h2 className="font-fraunces text-2xl mb-2">What are they buying?</h2>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="relative border border-escrow-ink/15 rounded-lg p-4 space-y-3 bg-white">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="absolute top-3 right-3 text-escrow-ink/30 hover:text-escrow-coral transition"
                    aria-label="Remove item"
                  >
                    <X size={16} />
                  </button>
                )}
                <input
                  type="text"
                  required
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal text-sm"
                  placeholder="Item name"
                />
                <div className="flex gap-3">
                  <input
                    type="number"
                    min={0}
                    required
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal text-sm"
                    placeholder="Unit price (₦)"
                  />
                  <input
                    type="number"
                    min={1}
                    required
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    className="w-24 px-3 py-2 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal text-sm"
                    placeholder="Qty"
                  />
                </div>

                {item.imageUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-cover border border-escrow-ink/10" />
                    <button
                      type="button"
                      onClick={() => updateItem(index, { imageUrl: undefined })}
                      className="text-xs text-escrow-ink/50 hover:text-escrow-coral transition"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 text-xs text-escrow-teal cursor-pointer hover:underline">
                    <ImagePlus size={14} strokeWidth={1.75} />
                    {item.uploading ? 'Uploading…' : 'Add photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={item.uploading}
                      onChange={(e) => handleImageUpload(index, e)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="inline-flex items-center gap-1.5 text-sm text-escrow-teal font-medium hover:underline"
          >
            <Plus size={15} strokeWidth={2} />
            Add another item
          </button>

          <div className="flex justify-between items-center border-t border-escrow-ink/10 pt-4">
            <span className="text-escrow-ink/60 text-sm">Total</span>
            <span className="text-xl font-fraunces">₦{total.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('buyer')}
              className="px-5 py-2.5 rounded-full border border-escrow-ink/20 text-sm font-medium hover:border-escrow-ink/40 transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!itemsValid}
              className="px-6 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              Review
            </button>
          </div>
        </form>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <h2 className="font-fraunces text-2xl mb-2">Review deal</h2>

          <div className="relative border border-escrow-ink/15 bg-white p-6 space-y-4">
            <CornerMarks />
            <div className="text-sm space-y-0.5">
              <p className="text-escrow-ink/50">Buyer</p>
              <p className="font-medium">{buyerName || 'Not specified'}</p>
              <p className="text-escrow-ink/70">{buyerPhone}</p>
              {buyerEmail && <p className="text-escrow-ink/70">{buyerEmail}</p>}
            </div>

            <div className="border-t border-escrow-ink/10 pt-4 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {item.imageUrl && '📷 '}
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-escrow-ink/70">
                    ₦{(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-escrow-ink/10 pt-4">
              <span className="text-escrow-ink/60 text-sm">Total</span>
              <span className="text-xl font-fraunces">₦{total.toLocaleString()}</span>
            </div>
          </div>

          {submitError && <p className="text-sm text-escrow-coral">{submitError}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('buyer')}
              className="px-5 py-2.5 rounded-full border border-escrow-ink/20 text-sm font-medium hover:border-escrow-ink/40 transition"
            >
              Edit
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Link'}
            </button>
          </div>
        </div>
      )}

      {step === 'success' && createdDeal && (
        <div className="space-y-6">
          <div>
            <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-2">Link created</p>
            <h2 className="font-fraunces text-2xl">Code: {createdDeal.shortCode}</h2>
          </div>

          <div className="relative border border-escrow-ink/15 bg-white p-4 flex items-center gap-3">
            <CornerMarks />
            <p className="flex-1 text-sm text-escrow-ink/70 truncate">{createdDeal.checkoutUrl}</p>
            <button
              onClick={handleCopyLink}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm text-escrow-teal font-medium hover:underline"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateAnother}
              className="px-5 py-2.5 rounded-full border border-escrow-ink/20 text-sm font-medium hover:border-escrow-ink/40 transition"
            >
              Create another
            </button>
            <button
              onClick={() => navigate('/deals')}
              className="px-6 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
