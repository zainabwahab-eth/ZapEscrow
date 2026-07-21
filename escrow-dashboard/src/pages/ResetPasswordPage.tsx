import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import PasswordInput from '../components/PasswordInput';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
      await authApi.resetPassword(token, password);
      navigate('/login', { state: { passwordReset: true } });
    } catch {
      setError('This reset link has expired or is invalid — please request a new one.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex flex-col">
      <div className="max-w-6xl mx-auto px-6 py-6 w-full">
        <Link to="/login" className="text-sm text-escrow-ink/60 hover:text-escrow-ink transition">
          ← Back to log in
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="font-fraunces text-3xl">Set a new password</h1>

          {!token ? (
            <p className="mt-8 text-sm text-escrow-coral">
              This reset link is missing its token — please request a new one from the{' '}
              <Link to="/forgot-password" className="underline">
                forgot password
              </Link>{' '}
              page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                  New password
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
                  Confirm new password
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
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
