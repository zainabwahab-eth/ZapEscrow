const STYLES: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-700',
  PAID: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  DISPUTED: 'bg-red-100 text-red-700',
  AUTO_RELEASED: 'bg-teal-100 text-teal-700',
  RELEASED: 'bg-teal-100 text-teal-700',
  REFUNDED: 'bg-purple-100 text-purple-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] ?? ''}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
