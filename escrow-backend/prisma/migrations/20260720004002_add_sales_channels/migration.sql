-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "salesChannels" TEXT[] DEFAULT ARRAY[]::TEXT[];
