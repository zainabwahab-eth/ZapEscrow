import { Bookmark } from 'lucide-react';

export default function BookmarkCallout() {
  return (
    <div className="border border-escrow-teal/30 bg-escrow-teal/5 rounded-lg p-4 flex gap-3">
      <Bookmark size={18} strokeWidth={1.75} className="text-escrow-teal shrink-0 mt-0.5" />
      <p className="text-sm text-escrow-ink/80 leading-relaxed">
        <span className="font-medium text-escrow-ink">Bookmark this page</span> — this is how you'll confirm you
        received your order and release payment to the seller. We'll also email you a reminder when it ships (if you
        gave an email).
      </p>
    </div>
  );
}
