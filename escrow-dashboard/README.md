# Escrow Dashboard

React + Tailwind dashboard for sellers — escrow totals, filterable deals
table. Buyers never touch this; they only get a lightweight checkout page
(not yet scaffolded here — see TODOs).

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```

## What's here
- `DashboardPage` — totals cards (in escrow / released / refunded) + filterable deals table
- `lib/api.ts` — typed API client hitting the NestJS backend's `/deals` endpoints

## TODOs (not built yet — next steps)
- **Auth**: login page + JWT storage; `DEMO_SELLER_ID` in `App.tsx` needs
  replacing with the real logged-in seller's id.
- **Seller signup/claim page** matching the backend's `POST /sellers/signup`
  (same-email claim flow described in project notes).
- **Deal creation form** (buyer info + itemized list) with the review/confirm
  step before hitting `POST /deals`.
- **Buyer-facing checkout page** (`/pay/:dealId`) — shows item image,
  description, amount, "your money is held in escrow" messaging, and the
  Monnify `checkoutUrl` redirect/embed. This is a separate, accountless
  route — keep it outside any auth guard.
- **Admin dispute queue view** — list of `DISPUTED` deals with both parties'
  statements and a release/refund action, calling
  `PATCH /deals/:id/resolve-dispute`.
- **Mark shipped action** in the deals table (currently only the API method
  exists in `lib/api.ts`, no UI trigger yet).
