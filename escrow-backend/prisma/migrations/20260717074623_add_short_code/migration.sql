-- AlterTable: add shortCode as nullable first so existing rows can be backfilled
ALTER TABLE "deals" ADD COLUMN "shortCode" TEXT;

-- Backfill existing rows with a unique 6-character code (ambiguous characters excluded)
DO $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  rec RECORD;
  new_code TEXT;
  i INT;
BEGIN
  FOR rec IN SELECT id FROM "deals" WHERE "shortCode" IS NULL LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "deals" WHERE "shortCode" = new_code);
    END LOOP;
    UPDATE "deals" SET "shortCode" = new_code WHERE id = rec.id;
  END LOOP;
END $$;

-- AlterTable: now that every row has a value, enforce NOT NULL + uniqueness
ALTER TABLE "deals" ALTER COLUMN "shortCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "deals_shortCode_key" ON "deals"("shortCode");
