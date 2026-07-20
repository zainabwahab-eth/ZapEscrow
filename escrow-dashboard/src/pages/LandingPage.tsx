import { Link } from 'react-router-dom';
import { useState } from 'react';
import CornerMarks from '../components/CornerMarks';

const TELEGRAM_BOT_URL = 'https://t.me/ZapEscrowBot';

const STEPS = [
  {
    number: '01',
    title: 'Buyer pays into escrow',
    body: 'Not straight to your account — into escrow instead. That one detail is often the difference between "let me think about it" and "sent!"',
  },
  {
    number: '02',
    title: 'Held safely',
    body: "Funds sit locked, untouched by either of you. No arguing over screenshots or 'proof of payment.'",
  },
  {
    number: '03',
    title: 'Buyer confirms',
    body: 'Once they confirm delivery — or the window closes without a word — the deal closes automatically.',
  },
  {
    number: '04',
    title: 'You get paid',
    body: 'Funds land in your settlement account on their own. No chasing, no waiting on a transfer.',
  },
];

const FAQS = [
  {
    q: 'Do my buyers need to sign up for anything?',
    a: 'No. Buyers just click the payment link you send — no account, no app, no login. They pay, and later confirm receipt, entirely without creating anything.',
  },
  {
    q: "What if a buyer says they didn't receive the item?",
    a: "The deal moves into review instead of releasing automatically. You'll get a chance to respond before anything is refunded.",
  },
  {
    q: "What if the buyer just goes silent?",
    a: "Funds release to you automatically after the response window closes — a buyer can't hold your money hostage by ignoring a message.",
  },
  {
    q: 'Can I use this without the dashboard, just on Telegram?',
    a: 'Yes — the Telegram bot handles deal creation, shipment updates, and payouts end to end. The dashboard is there if you want a broader view.',
  },
];

function ProblemIllustration() {
  return (
    <svg viewBox="0 0 420 200" fill="none" className="w-full h-auto text-escrow-ink" aria-hidden="true">
      <rect x="24" y="30" width="72" height="140" rx="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="48" y1="152" x2="72" y2="152" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="60" cy="70" r="16" stroke="currentColor" strokeWidth="1.5" />
      <text x="60" y="76" textAnchor="middle" fontSize="16" fill="currentColor" fontFamily="serif">₦</text>
      <path d="M110 95 C 180 40, 260 40, 330 90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
      <path d="M318 78 L332 90 L316 98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="215" y="150" textAnchor="middle" fontSize="64" fontFamily="Fraunces, serif" fill="currentColor" opacity="0.85">?</text>
      <rect x="324" y="30" width="72" height="140" rx="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.5" />
      <line x1="348" y1="152" x2="372" y2="152" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-escrow-ink/10 py-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left gap-4"
      >
        <span className="font-medium">{q}</span>
        <span className="text-escrow-ink/40 text-xl leading-none flex-shrink-0">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-3 text-sm text-escrow-ink/65 leading-relaxed max-w-2xl">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="font-fraunces text-xl tracking-tight">Zap</span>
        <div className="flex items-center gap-6">
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-escrow-ink/60 hover:text-escrow-ink transition hidden sm:inline">
            @ZapEscrowBot
          </a>
          <Link to="/login" className="text-sm text-escrow-ink/70 hover:text-escrow-ink transition">
            Log in
          </Link>
        </div>
      </header>

      {/* Hero — asymmetric, left-aligned */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-[1.3fr_1fr] gap-12 items-end">
        <div>
          <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-5">Escrow for DM sellers</p>
          <h1 className="font-fraunces text-4xl sm:text-5xl md:text-[3.4rem] leading-[1.08]">
            Never lose a sale to<br />"is this a scam?" again.
          </h1>
          <p className="mt-6 text-lg text-escrow-ink/70 max-w-md">
            Zap lets your buyers pay into escrow instead of straight to your account — so hesitant customers say
            yes, and you still get paid the moment they confirm delivery.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/signup" className="px-7 py-3 rounded-full bg-escrow-teal text-white font-medium hover:opacity-90 transition text-center">
              Get Started
            </Link>
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="px-7 py-3 rounded-full border border-escrow-ink/20 font-medium hover:border-escrow-ink/40 transition text-center">
              Use Telegram Bot
            </a>
          </div>
        </div>

        <div className="relative border border-escrow-ink/15 p-6 bg-white/50">
          <CornerMarks />
          <p className="font-mono text-xs tracking-widest text-escrow-ink/40 uppercase">Live escrow</p>
          <p className="font-fraunces text-4xl mt-3">₦8,000</p>
          <p className="text-sm text-escrow-ink/60 mt-1">Held for 3 days · releases automatically in 4</p>
          <div className="mt-4 h-1.5 rounded-full bg-escrow-ink/10 overflow-hidden">
            <div className="h-full w-[43%] bg-escrow-teal rounded-full" />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center border-t border-escrow-ink/10">
        <div>
          <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-3">The problem</p>
          <h2 className="font-fraunces text-3xl md:text-4xl leading-tight">
            Right now, hesitant buyers cost you sales.
          </h2>
          <p className="mt-5 text-escrow-ink/70 leading-relaxed">
            Every day, buyers ghost mid-checkout because they don't know if you'll actually deliver. The ones who
            do pay make you sweat until the money clears — and if a dispute comes up, you're arguing it out alone.
          </p>
        </div>
        <ProblemIllustration />
      </section>

      {/* Big stat */}
      <section className="bg-escrow-ink text-escrow-cream">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-3">Why it works</p>
            <h2 className="font-fraunces text-3xl md:text-4xl leading-tight">
              Buyers convert more when the risk isn't on them anymore.
            </h2>
          </div>
          <p className="font-fraunces text-6xl md:text-7xl whitespace-nowrap">0 → 1</p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/60 border-b border-escrow-ink/10">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <p className="font-mono text-xs tracking-widest text-escrow-teal uppercase mb-3">How Zap works</p>
          <h2 className="font-fraunces text-3xl md:text-4xl">Four steps. No surprises.</h2>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {STEPS.map((step) => (
              <div key={step.number} className="relative border border-escrow-ink/10 p-5 bg-escrow-cream">
                <CornerMarks />
                <span className="font-fraunces text-3xl text-escrow-teal">{step.number}</span>
                <h3 className="font-medium text-lg mt-3">{step.title}</h3>
                <p className="mt-2 text-sm text-escrow-ink/65 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="relative border border-escrow-ink/15 p-8 md:p-12 max-w-2xl mx-auto text-center bg-white/50">
          <CornerMarks />
          <p className="font-fraunces text-2xl md:text-3xl leading-snug">
            "I used to lose at least one sale a week to someone who just wanted to 'think about it.' Now they pay
            immediately because they know their money's protected."
          </p>
          <p className="mt-6 text-sm text-escrow-ink/60 font-mono">Early ZapEscrow seller</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-24 border-t border-escrow-ink/10">
        <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-3">Questions</p>
        <h2 className="font-fraunces text-3xl md:text-4xl mb-8">Have any questions? We've got answers.</h2>
        <div>
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-escrow-teal text-escrow-cream">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="font-fraunces text-3xl md:text-4xl">Stop losing sales to trust issues.</h2>
          <p className="mt-4 text-escrow-cream/80 max-w-lg mx-auto">
            Your buyers get the same protection big retailers offer — you get paid faster because they finally
            trust you enough to hit "pay now."
          </p>
          <Link to="/signup" className="inline-block mt-8 px-7 py-3 rounded-full bg-escrow-cream text-escrow-teal font-medium hover:opacity-90 transition">
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-escrow-ink/60">
        <div>
          <span className="font-fraunces text-base text-escrow-ink">Zap</span>
          <span className="ml-2">Escrow for DM sales.</span>
        </div>
        <div className="flex items-center gap-6">
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-escrow-ink transition">
            Talk to the Telegram bot →
          </a>
          <span>© 2026 Zap</span>
        </div>
      </footer>
    </div>
  );
}