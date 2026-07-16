import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export interface DealItem {
  id: string;
  name: string;
  imageUrl?: string;
  unitPrice: string;
  quantity: number;
}

export interface Deal {
  id: string;
  buyerName?: string;
  buyerPhone: string;
  buyerEmail?: string;
  amount: string;
  status:
    | 'CREATED'
    | 'PAID'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'DISPUTED'
    | 'AUTO_RELEASED'
    | 'RELEASED'
    | 'REFUNDED'
    | 'EXPIRED';
  checkoutUrl?: string;
  autoReleaseDeadline?: string;
  createdAt: string;
  items: DealItem[];
}

export interface SellerTotals {
  totalInEscrow: string;
  totalReleased: string;
  totalRefunded: string;
}

export const dealsApi = {
  listForSeller: (sellerId: string, status?: string) =>
    api
      .get<Deal[]>(`/deals/seller/${sellerId}`, { params: status ? { status } : {} })
      .then((r) => r.data),

  getTotals: (sellerId: string) =>
    api.get<SellerTotals>(`/deals/seller/${sellerId}/totals`).then((r) => r.data),

  markShipped: (dealId: string, estimatedDeliveryDate?: string) =>
    api.patch(`/deals/${dealId}/ship`, { estimatedDeliveryDate }).then((r) => r.data),

  resolveDispute: (dealId: string, resolution: 'RELEASED' | 'REFUNDED') =>
    api.patch(`/deals/${dealId}/resolve-dispute`, { resolution }).then((r) => r.data),
};

export interface PublicDeal {
  id: string;
  sellerName: string;
  sellerVerified: boolean;
  buyerName?: string;
  amount: string;
  status: string;
  checkoutUrl: string;
  items: { name: string; imageUrl?: string; unitPrice: string; quantity: number }[];
}

export const publicDealApi = {
  get: (dealId: string) => api.get<PublicDeal>(`/deals/${dealId}/public`).then((r) => r.data),
};
