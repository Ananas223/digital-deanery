-- AlterTable: nullable column, затем backfill существующих заявок (122 бита).
ALTER TABLE "request" ADD COLUMN "verifyCode" TEXT;

-- Backfill: существующие строки получают неперебираемый код.
UPDATE "request" SET "verifyCode" = gen_random_uuid()::text WHERE "verifyCode" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "request_verifyCode_key" ON "request"("verifyCode");
