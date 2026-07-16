-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('CREATED', 'PAID', 'SHIPPED', 'DELIVERED', 'DISPUTED', 'AUTO_RELEASED', 'RELEASED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DealEventActor" AS ENUM ('SELLER', 'BUYER', 'SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('RELEASED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_DIGEST', 'DISPUTE_ALERT', 'DEADLINE_REMINDER', 'PAYMENT_CONFIRMED', 'SHIPPED_REMINDER');

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "businessName" TEXT NOT NULL,
    "telegramId" TEXT,
    "passwordHash" TEXT,
    "monnifySettlementAccount" TEXT,
    "monnifySettlementBankCode" TEXT,
    "verifiedBadge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerPhone" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerTelegramId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "transactionReference" TEXT,
    "checkoutUrl" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'CREATED',
    "estimatedDeliveryDate" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "autoReleaseDeadline" TIMESTAMP(3),
    "deliveredConfirmedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_items" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "deal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_events" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus" NOT NULL,
    "actor" "DealEventActor" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "raisedBy" "DealEventActor" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "sellerResponse" TEXT,
    "resolution" "DisputeResolution",
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "monnifyReference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_email_key" ON "sellers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_telegramId_key" ON "sellers"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_paymentReference_key" ON "deals"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "deals_transactionReference_key" ON "deals"("transactionReference");

-- CreateIndex
CREATE INDEX "deals_sellerId_status_idx" ON "deals"("sellerId", "status");

-- CreateIndex
CREATE INDEX "deal_events_dealId_idx" ON "deal_events"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_transactionReference_eventType_key" ON "webhook_events"("transactionReference", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_dealId_key" ON "disputes"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_dealId_key" ON "disbursements"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_monnifyReference_key" ON "disbursements"("monnifyReference");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
