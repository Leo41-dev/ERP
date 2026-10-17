-- AlterEnum
ALTER TYPE "SatisDurum" ADD VALUE 'IADE';

-- AlterTable
ALTER TABLE "CariHareket" ADD COLUMN     "geriOdemeId" INTEGER,
ADD COLUMN     "iadeId" INTEGER;

-- CreateTable
CREATE TABLE "Iade" (
    "id" SERIAL NOT NULL,
    "iadeNo" SERIAL NOT NULL,
    "satisId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tutar" DECIMAL(14,2) NOT NULL,
    "otvToplam" DECIMAL(14,2) NOT NULL,
    "kdvToplam" DECIMAL(14,2) NOT NULL,
    "neden" TEXT NOT NULL,
    "faturaNo" TEXT,
    "kaydeden" TEXT NOT NULL,

    CONSTRAINT "Iade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IadeKalemi" (
    "id" SERIAL NOT NULL,
    "iadeId" INTEGER NOT NULL,
    "satisKalemiId" INTEGER NOT NULL,
    "miktar" DECIMAL(14,3) NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "IadeKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeriOdeme" (
    "id" SERIAL NOT NULL,
    "iadeId" INTEGER NOT NULL,
    "yontem" "OdemeYontem" NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "aciklama" TEXT,

    CONSTRAINT "GeriOdeme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Iade_iadeNo_key" ON "Iade"("iadeNo");

-- CreateIndex
CREATE INDEX "Iade_tarih_idx" ON "Iade"("tarih");

-- CreateIndex
CREATE UNIQUE INDEX "CariHareket_geriOdemeId_key" ON "CariHareket"("geriOdemeId");

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_geriOdemeId_fkey" FOREIGN KEY ("geriOdemeId") REFERENCES "GeriOdeme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iade" ADD CONSTRAINT "Iade_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeKalemi" ADD CONSTRAINT "IadeKalemi_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IadeKalemi" ADD CONSTRAINT "IadeKalemi_satisKalemiId_fkey" FOREIGN KEY ("satisKalemiId") REFERENCES "SatisKalemi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeriOdeme" ADD CONSTRAINT "GeriOdeme_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

