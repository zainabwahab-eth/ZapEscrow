-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'IN_APP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DISBURSEMENT_MISSING';
ALTER TYPE "NotificationType" ADD VALUE 'FUNDS_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'DEAL_PAID';

-- AlterTable
ALTER TABLE "notification_log" ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;
