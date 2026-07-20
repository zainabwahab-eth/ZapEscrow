export default function CornerMarks() {
  return (
    <>
      <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t border-l border-escrow-ink/30" />
      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t border-r border-escrow-ink/30" />
      <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b border-l border-escrow-ink/30" />
      <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b border-r border-escrow-ink/30" />
    </>
  );
}
