-- CreateEnum
CREATE TYPE "SayimDurum" AS ENUM ('ACIK', 'KAPALI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StokHareketTur" ADD VALUE 'CIKIS';
ALTER TYPE "StokHareketTur" ADD VALUE 'IPTAL';

-- AlterTable
ALTER TABLE "StokHareketi" ADD COLUMN     "bakiye" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "birimMaliyet" DECIMAL(14,4),
ADD COLUMN     "iadeId" INTEGER,
ADD COLUMN     "kaydeden" TEXT,
ADD COLUMN     "satisKalemiId" INTEGER,
ADD COLUMN     "sayimId" INTEGER,
ADD COLUMN     "stokGirisId" INTEGER;

-- AlterTable
ALTER TABLE "Urun" ADD COLUMN     "miktar" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "not" TEXT,
ADD COLUMN     "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ortMaliyet" DECIMAL(14,4);

-- CreateTable
CREATE TABLE "StokGiris" (
    "id" SERIAL NOT NULL,
    "girisNo" SERIAL NOT NULL,
    "tedarikciId" INTEGER,
    "faturaNo" TEXT,
    "tarih" DATE NOT NULL,
    "araToplam" DECIMAL(14,2) NOT NULL,
    "kdvToplam" DECIMAL(14,2) NOT NULL,
    "genelToplam" DECIMAL(14,2) NOT NULL,
    "kaynak" TEXT NOT NULL DEFAULT 'ELLE',
    "not" TEXT,
    "kaydeden" TEXT NOT NULL,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokGiris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokGirisKalemi" (
    "id" SERIAL NOT NULL,
    "girisId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "urunId" INTEGER NOT NULL,
    "faturaAdi" TEXT,
    "miktar" DECIMAL(14,3) NOT NULL,
    "birimFiyat" DECIMAL(14,4) NOT NULL,
    "kdvOrani" DECIMAL(6,4) NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "StokGirisKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrunEsleme" (
    "anahtar" TEXT NOT NULL,
    "urunId" INTEGER NOT NULL,
    "guncelleme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrunEsleme_pkey" PRIMARY KEY ("anahtar")
);

-- CreateTable
CREATE TABLE "Sayim" (
    "id" SERIAL NOT NULL,
    "sayimNo" SERIAL NOT NULL,
    "aciklama" TEXT NOT NULL,
    "durum" "SayimDurum" NOT NULL DEFAULT 'ACIK',
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kapanis" TIMESTAMP(3),
    "kaydeden" TEXT NOT NULL,

    CONSTRAINT "Sayim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SayimSatiri" (
    "id" SERIAL NOT NULL,
    "sayimId" INTEGER NOT NULL,
    "urunId" INTEGER NOT NULL,
    "sayilan" DECIMAL(14,3) NOT NULL,
    "sistem" DECIMAL(14,3),
    "guncelleme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SayimSatiri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StokGiris_girisNo_key" ON "StokGiris"("girisNo");

-- CreateIndex
CREATE INDEX "StokGiris_tedarikciId_faturaNo_idx" ON "StokGiris"("tedarikciId", "faturaNo");

-- CreateIndex
CREATE UNIQUE INDEX "Sayim_sayimNo_key" ON "Sayim"("sayimNo");

-- CreateIndex
CREATE UNIQUE INDEX "SayimSatiri_sayimId_urunId_key" ON "SayimSatiri"("sayimId", "urunId");

-- CreateIndex
CREATE INDEX "StokHareketi_satisId_idx" ON "StokHareketi"("satisId");

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_iadeId_fkey" FOREIGN KEY ("iadeId") REFERENCES "Iade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_stokGirisId_fkey" FOREIGN KEY ("stokGirisId") REFERENCES "StokGiris"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_sayimId_fkey" FOREIGN KEY ("sayimId") REFERENCES "Sayim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokGiris" ADD CONSTRAINT "StokGiris_tedarikciId_fkey" FOREIGN KEY ("tedarikciId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokGirisKalemi" ADD CONSTRAINT "StokGirisKalemi_girisId_fkey" FOREIGN KEY ("girisId") REFERENCES "StokGiris"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokGirisKalemi" ADD CONSTRAINT "StokGirisKalemi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrunEsleme" ADD CONSTRAINT "UrunEsleme_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SayimSatiri" ADD CONSTRAINT "SayimSatiri_sayimId_fkey" FOREIGN KEY ("sayimId") REFERENCES "Sayim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SayimSatiri" ADD CONSTRAINT "SayimSatiri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

