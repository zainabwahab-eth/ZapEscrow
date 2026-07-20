import CornerMarks from '../components/CornerMarks';

export default function InvoicingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative border border-escrow-ink/15 bg-white p-10 max-w-md text-center">
        <CornerMarks />
        <p className="font-mono text-xs tracking-widest text-escrow-coral uppercase mb-3">Coming soon</p>
        <h2 className="font-fraunces text-3xl">Invoicing is coming soon</h2>
        <p className="mt-4 text-sm text-escrow-ink/65 leading-relaxed">
          Soon you'll be able to generate and send itemized invoices directly from Zap — no more typing out item
          lists by hand.
        </p>
      </div>
    </div>
  );
}
