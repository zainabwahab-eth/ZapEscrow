-- AlterTable
-- Added as nullable first, backfilled for existing rows, then tightened to
-- NOT NULL + UNIQUE — a plain `ADD COLUMN ... NOT NULL` would fail against
-- rows that already exist, since confirmationToken has no DB-level default
-- (it's generated client-side by Prisma at insert time, same as `id`).
ALTER TABLE "deals" ADD COLUMN "confirmationToken" TEXT;

UPDATE "deals" SET "confirmationToken" = gen_random_uuid()::text WHERE "confirmationToken" IS NULL;

ALTER TABLE "deals" ALTER COLUMN "confirmationToken" SET NOT NULL;

-- CreateIndex
ALTER TABLE "deals" ADD CONSTRAINT "deals_confirmationToken_key" UNIQUE ("confirmationToken");
