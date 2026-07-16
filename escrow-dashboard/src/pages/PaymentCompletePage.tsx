import { useParams } from 'react-router-dom';

export default function PaymentCompletePage() {
  const { dealId } = useParams();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-semibold text-gray-900">Payment received</h1>
        <p className="text-gray-500">
          Your money is safely held in escrow. You'll get a message once your order ships,
          and you can confirm receipt then to release payment to the seller.
        </p>
      </div>
    </div>
  );
}
