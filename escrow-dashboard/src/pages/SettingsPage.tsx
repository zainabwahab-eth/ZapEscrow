import { useEffect, useState, type FormEvent } from 'react';
import { sellersApi, monnifyApi, type MonnifyBank } from '../lib/api';
import { useAuth } from '../lib/auth';

type DisbursementStep = 'idle' | 'editing' | 'confirming';

export default function SettingsPage() {
  const { seller, setSeller } = useAuth();
  const current = seller!;

  const [banks, setBanks] = useState<MonnifyBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  function bankName(code?: string | null) {
    if (!code) return 'Unknown bank';
    const match = banks.find((b) => b.code === code);
    if (match) return match.name;
    return banksLoading ? 'Loading…' : code;
  }

  const [businessName, setBusinessName] = useState(current.businessName);
  const [phone, setPhone] = useState(current.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const updated = await sellersApi.updateProfile({ businessName, phone });
      setSeller(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      setProfileError("Couldn't save your changes — please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  const [step, setStep] = useState<DisbursementStep>('idle');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    monnifyApi
      .getBanks()
      .then((list) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        setBanks(sorted);
        setBankCode((prev) => prev || sorted[0]?.code || '');
      })
      .catch(() => {})
      .finally(() => setBanksLoading(false));
  }, []);

  async function handleCheckAccount(e: FormEvent) {
    e.preventDefault();
    setAccountError(null);
    setChecking(true);
    try {
      const { accountName } = await monnifyApi.nameEnquiry(accountNumber, bankCode);
      if (!accountName) {
        setAccountError("Couldn't resolve that account — double-check the number and bank.");
        return;
      }
      setResolvedName(accountName);
      setStep('confirming');
    } catch {
      setAccountError("Couldn't verify that account — double-check the details and try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirmAccount() {
    setAccountError(null);
    setSavingAccount(true);
    try {
      const updated = await sellersApi.updateSettlementAccount(current.id, accountNumber, bankCode);
      setSeller(updated);
      setStep('idle');
      setAccountNumber('');
      setResolvedName(null);
    } catch {
      setAccountError("Couldn't save that account — please try again.");
    } finally {
      setSavingAccount(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <section className="bg-white rounded-xl border border-escrow-ink/10 p-6">
        <p className="font-mono text-xs tracking-widest text-escrow-ink/40 uppercase mb-1">Profile</p>
        <h2 className="font-fraunces text-2xl mb-6">Business details</h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Business name</label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Email</label>
            <input
              type="email"
              readOnly
              value={current.email}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/10 bg-escrow-cream/60 text-escrow-ink/60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal"
            />
          </div>

          {profileError && <p className="text-sm text-escrow-coral">{profileError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
            {profileSaved && <span className="text-sm text-escrow-teal">Saved</span>}
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-escrow-ink/10 p-6">
        <p className="font-mono text-xs tracking-widest text-escrow-ink/40 uppercase mb-1">Payouts</p>
        <h2 className="font-fraunces text-2xl mb-6">Disbursement account</h2>

        {step === 'idle' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {current.monnifySettlementAccount ? (
              <p className="text-sm text-escrow-ink/80">
                •••• {current.monnifySettlementAccount.slice(-4)} — {bankName(current.monnifySettlementBankCode)}
              </p>
            ) : (
              <p className="text-sm text-escrow-ink/50">No disbursement account on file yet.</p>
            )}
            <button
              onClick={() => setStep('editing')}
              className="px-4 py-2 rounded-full border border-escrow-ink/20 text-sm font-medium hover:border-escrow-ink/40 transition shrink-0 self-start sm:self-auto"
            >
              {current.monnifySettlementAccount ? 'Update' : 'Add account'}
            </button>
          </div>
        )}

        {step === 'editing' && (
          <form onSubmit={handleCheckAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Account number</label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal"
                placeholder="0123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-escrow-ink/70 mb-1.5">Bank</label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-escrow-ink/15 focus:outline-none focus:ring-2 focus:ring-escrow-teal bg-white"
              >
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {accountError && <p className="text-sm text-escrow-coral">{accountError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={checking}
                className="px-5 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {checking ? 'Checking…' : 'Verify account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('idle');
                  setAccountError(null);
                }}
                className="text-sm text-escrow-ink/50 hover:text-escrow-ink transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'confirming' && (
          <div className="space-y-4">
            <p className="text-sm text-escrow-ink/80">
              Confirm this is you: <span className="font-medium text-escrow-ink">{resolvedName}</span>?
            </p>
            {accountError && <p className="text-sm text-escrow-coral">{accountError}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmAccount}
                disabled={savingAccount}
                className="px-5 py-2.5 rounded-full bg-escrow-teal text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {savingAccount ? 'Saving…' : 'Confirm'}
              </button>
              <button
                onClick={() => {
                  setStep('editing');
                  setAccountError(null);
                }}
                className="text-sm text-escrow-ink/50 hover:text-escrow-ink transition"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
