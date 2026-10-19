-- CreateEnum
CREATE TYPE "SatisTur" AS ENUM ('ARAC', 'HIZLI');

-- AlterTable
ALTER TABLE "Satis" ADD COLUMN     "tur" "SatisTur" NOT NULL DEFAULT 'ARAC';

-- CreateIndex
CREATE INDEX "Satis_tur_tarih_idx" ON "Satis"("tur", "tarih");
