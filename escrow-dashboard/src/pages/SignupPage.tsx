import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import PasswordInput from '../components/PasswordInput';

type Step = 'email' | 'otp' | 'password';

const RESEND_COOLDOWN_SECONDS = 30;

export default function SignupPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAccountExists(false);
    setLoading(true);
    try {
      await authApi.signupStart(email);
      setStep('otp');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(err.response.data?.message ?? 'An account with this email already exists. Please log in instead.');
        setAccountExists(true);
      } else {
        setError("Couldn't send a code to that address — please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError(null);
    setResendMessage(null);
    try {
      await authApi.signupStart(email);
      setResendMessage('Sent — check your email.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Couldn't resend the code — please try again.");
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { verifiedToken } = await authApi.verifyOtp(email, code);
      setVerifiedToken(verifiedToken);
      setStep('password');
    } catch {
      setError("That code doesn't match — check your email and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { token, seller } = await authApi.completeSignup(email, password, verifiedToken);
      auth.login(token, seller);
      navigate(seller.businessName ? '/dashboard' : '/onboarding');
    } catch {
      setError('Verification expired — please start signup again.');
      setStep('email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex flex-col">
      <div className="max-w-6xl mx-auto px-6 py-6 w-full">
        <Link to="/" className="text-sm text-escrow-ink/60 hover:text-escrow-ink transition">
          ← Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="font-fraunces text-3xl">Create your account</h1>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="text-sm text-escrow-coral">
                  {error}
                  {accountExists && (
                    <>
                      {' '}
                      <Link to="/login" className="underline font-medium">
                        Log in instead
                      </Link>
                    </>
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send code'}
              </button>

              <p className="text-xs text-escrow-ink/50 text-center pt-1">
                Already used our Telegram bot? Use the same email — we'll find your account.
              </p>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="mt-8 space-y-4">
              <p className="text-sm text-escrow-ink/70">
                We sent a 6-digit code to <span className="font-medium text-escrow-ink">{email}</span>.
              </p>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                  Verification code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-300 bg-white tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-escrow-teal"
                  placeholder="••••••"
                />
              </div>

              {error && <p className="text-sm text-escrow-coral">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify code'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-escrow-teal font-medium hover:underline disabled:text-escrow-ink/40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </button>
                {resendMessage && <p className="text-xs text-escrow-ink/50 mt-1">{resendMessage}</p>}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                  setResendMessage(null);
                  setResendCooldown(0);
                }}
                className="w-full text-sm text-escrow-ink/50 hover:text-escrow-ink transition"
              >
                ← Use a different email
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                  Confirm password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-sm text-escrow-coral">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <p className="mt-8 text-sm text-escrow-ink/60 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-escrow-teal font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
