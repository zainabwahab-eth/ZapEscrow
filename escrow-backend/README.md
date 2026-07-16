# Escrow Backend

AI-powered escrow platform for social commerce, built on Monnify. Sellers
create a deal (Telegram bot or dashboard), buyers pay into escrow with no
signup required, and funds release automatically once the buyer confirms
receipt — or after a deadline passes with no response, mirroring the
Alipay/Taobao pattern.

## Stack
- NestJS + TypeScript
- Prisma + Postgres (Supabase)
- Redis (in-progress Telegram deal drafts)
- Telegraf (Telegram bot)
- Monnify (Checkout API for collection, Single Disbursement API for release)
- NVIDIA NIM (primary AI provider, OpenRouter as fallback) — OpenAI-SDK compatible

## Setup

```bash
npm install
cp .env.example .env   # fill in real values
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

## Before you can test the full flow

1. **Monnify sandbox**: grab API Key / Secret Key / Contract Code from
   Developer > API Keys & Contracts. Confirm you're pointed at
   `https://sandbox.monnify.com`.
2. **Disbursement OTP waiver**: email `integration-support@monnify.com`
   requesting Single Disbursement API activation + OTP waiver on Sandbox.
   Without this, every release will come back `PENDING_AUTHORIZATION`
   instead of completing automatically.
3. **Webhook URL**: use `ngrok http 3000` locally, then set
   `https://<your-ngrok-id>.ngrok.io/webhooks/monnify` under
   Developer > Webhook URLs in the Monnify dashboard (Transaction
   Completion event).
4. **Telegram bot token**: from @BotFather.
5. **Redis**: run locally (`docker run -p 6379:6379 redis`) or point
   `REDIS_URL` at a hosted instance.

## Deal lifecycle

```
CREATED -> PAID -> SHIPPED -> DISPUTED -> (RELEASED | REFUNDED)
                            -> DELIVERED -> RELEASED
                            -> AUTO_RELEASED -> RELEASED
```

See `src/deals/deals.service.ts` for the full state machine — every
transition writes a `DealEvent` row for audit trail.

## Known gaps / TODOs (intentionally left for hackathon time constraints)

- Refund flow to buyer isn't wired to a real Monnify call yet
  (`resolveDispute` has a TODO).
- Telegram bot's buyer-phone follow-up question doesn't yet re-enter the
  draft flow — needs a small per-user conversation state machine.
- No auth/JWT guards on controllers yet — add before anything beyond a demo.
- Deadline *reminder* (as opposed to auto-release itself) isn't sent yet —
  needs a `reminderSentAt` field to avoid re-pinging hourly.
- Seller settlement account isn't verified via Monnify's Name Enquiry API
  before being saved — worth adding for a "verified seller" trust signal.
