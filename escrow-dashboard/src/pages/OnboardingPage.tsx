import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { sellersApi } from '../lib/api';
import { useAuth } from '../lib/auth';

const CHANNELS = ['Instagram', 'WhatsApp', 'Twitter/X', 'Other'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [salesChannels, setSalesChannels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already onboarded (e.g. revisited this route directly) — nothing to do here.
  useEffect(() => {
    if (auth.seller?.businessName) {
      navigate('/dashboard', { replace: true });
    }
  }, [auth.seller, navigate]);

  function toggleChannel(channel: string) {
    setSalesChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const seller = await sellersApi.updateOnboarding({ businessName, phone, salesChannels });
      auth.setSeller(seller);
      navigate('/dashboard');
    } catch {
      setError("Couldn't save your details — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-fraunces text-3xl">Tell us about your business</h1>
        <p className="mt-2 text-sm text-escrow-ink/60">
          This helps buyers trust you and helps us route your payouts correctly.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
              Business name
            </label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              placeholder="e.g. Musa Fashion Store"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              placeholder="080..."
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-escrow-ink/70 mb-2">Where do you sell?</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const active = salesChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                      active ? 'bg-escrow-teal text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-escrow-coral">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
