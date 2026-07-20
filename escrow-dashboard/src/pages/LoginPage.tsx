import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, seller } = await authApi.login(email, password);
      auth.login(token, seller);
      navigate(seller.businessName ? '/dashboard' : '/onboarding');
    } catch {
      setError('Invalid email or password.');
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
          <h1 className="font-fraunces text-3xl">Welcome back</h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                Email
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-escrow-ink/70 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-escrow-teal"
              />
            </div>

            {error && <p className="text-sm text-escrow-coral">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="mt-8 text-sm text-escrow-ink/60 text-center">
            New to Zap?{' '}
            <Link to="/signup" className="text-escrow-teal font-medium">
              Get started
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
