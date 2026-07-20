import axios from 'axios';
import { getAuthToken } from './auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
  shortCode: string;
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

export interface Seller {
  id: string;
  email: string;
  phone?: string | null;
  businessName: string;
  telegramId?: string | null;
  monnifySettlementAccount?: string | null;
  monnifySettlementBankCode?: string | null;
  verifiedBadge: boolean;
  emailVerifiedAt?: string | null;
  salesChannels: string[];
  createdAt: string;
  updatedAt: string;
}

export const authApi = {
  signupStart: (email: string) =>
    api.post<{ message: string }>('/auth/signup/start', { email }).then((r) => r.data),

  verifyOtp: (email: string, code: string) =>
    api.post<{ verifiedToken: string }>('/auth/signup/verify-otp', { email, code }).then((r) => r.data),

  completeSignup: (email: string, password: string, verifiedToken: string) =>
    api
      .post<{ token: string; seller: Seller }>('/auth/signup/complete', { email, password, verifiedToken })
      .then((r) => r.data),

  login: (email: string, password: string) =>
    api.post<{ token: string; seller: Seller }>('/auth/login', { email, password }).then((r) => r.data),
};

export const sellersApi = {
  me: () => api.get<Seller>('/sellers/me').then((r) => r.data),

  updateOnboarding: (params: { businessName: string; phone: string; salesChannels: string[] }) =>
    api.patch<Seller>('/sellers/onboarding', params).then((r) => r.data),

  updateProfile: (params: { businessName: string; phone: string }) =>
    api.patch<Seller>('/sellers/me', params).then((r) => r.data),

  updateSettlementAccount: (sellerId: string, accountNumber: string, bankCode: string) =>
    api
      .patch<Seller>(`/sellers/${sellerId}/settlement-account`, { accountNumber, bankCode })
      .then((r) => r.data),
};

export const monnifyApi = {
  nameEnquiry: (accountNumber: string, bankCode: string) =>
    api
      .get<{ accountName: string | null }>('/monnify/name-enquiry', {
        params: { account: accountNumber, bank: bankCode },
      })
      .then((r) => r.data),
};

export interface Notification {
  id: string;
  sellerId: string;
  type: 'DISBURSEMENT_MISSING' | 'FUNDS_RELEASED' | 'DISPUTE_ALERT' | 'DEAL_PAID' | string;
  channel: string;
  payload?: { dealId?: string; amount?: string; code?: string } | null;
  read: boolean;
  sentAt: string;
}

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};
