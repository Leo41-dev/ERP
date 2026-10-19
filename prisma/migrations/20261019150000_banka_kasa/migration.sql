-- CreateEnum
CREATE TYPE "HesapTur" AS ENUM ('KASA', 'BANKA', 'POS', 'KREDI_KARTI');

-- CreateEnum
CREATE TYPE "HareketKaynak" AS ENUM ('MANUEL', 'TAHSILAT', 'GERI_ODEME', 'VIRMAN', 'ENTEGRASYON');

-- CreateEnum
CREATE TYPE "KategoriTur" AS ENUM ('GELIR', 'GIDER');

-- AlterTable
ALTER TABLE "CariHareket" ADD COLUMN     "hesapHareketiId" INTEGER;

-- AlterTable
ALTER TABLE "GeriOdeme" ADD COLUMN     "hesapId" INTEGER;

-- AlterTable
ALTER TABLE "Tahsilat" ADD COLUMN     "hesapId" INTEGER;

-- CreateTable
CREATE TABLE "FinansHesabi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "HesapTur" NOT NULL,
    "firmaId" INTEGER,
    "banka" TEXT,
    "sube" TEXT,
    "hesapNo" TEXT,
    "iban" TEXT,
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "acilisBakiye" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "acilisTarihi" DATE NOT NULL,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinansHesabi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinansKategori" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "KategoriTur" NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FinansKategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HesapHareketi" (
    "id" SERIAL NOT NULL,
    "hesapId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "giris" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cikis" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "belgeNo" TEXT,
    "kategoriId" INTEGER,
    "cariId" INTEGER,
    "tahsilatId" INTEGER,
    "geriOdemeId" INTEGER,
    "virmanNo" TEXT,
    "kaynak" "HareketKaynak" NOT NULL DEFAULT 'MANUEL',
    "disReferans" TEXT,
    "kaydeden" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iptalZamani" TIMESTAMP(3),
    "iptalEden" TEXT,
    "iptalNedeni" TEXT,

    CONSTRAINT "HesapHareketi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinansHesabi_ad_key" ON "FinansHesabi"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "FinansKategori_tur_ad_key" ON "FinansKategori"("tur", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "HesapHareketi_tahsilatId_key" ON "HesapHareketi"("tahsilatId");

-- CreateIndex
CREATE UNIQUE INDEX "HesapHareketi_geriOdemeId_key" ON "HesapHareketi"("geriOdemeId");

-- CreateIndex
CREATE INDEX "HesapHareketi_hesapId_tarih_idx" ON "HesapHareketi"("hesapId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "HesapHareketi_hesapId_disReferans_key" ON "HesapHareketi"("hesapId", "disReferans");

-- CreateIndex
CREATE UNIQUE INDEX "CariHareket_hesapHareketiId_key" ON "CariHareket"("hesapHareketiId");

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeriOdeme" ADD CONSTRAINT "GeriOdeme_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "FinansHesabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tahsilat" ADD CONSTRAINT "Tahsilat_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "FinansHesabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinansHesabi" ADD CONSTRAINT "FinansHesabi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "FinansHesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "FinansKategori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_tahsilatId_fkey" FOREIGN KEY ("tahsilatId") REFERENCES "Tahsilat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_geriOdemeId_fkey" FOREIGN KEY ("geriOdemeId") REFERENCES "GeriOdeme"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Varsayılan gelir/gider kategorileri (Ayarlar → Finans'ta değiştirilebilir)
INSERT INTO "FinansKategori" ("ad", "tur") VALUES
  ('Kira', 'GIDER'), ('Elektrik, su, doğalgaz', 'GIDER'), ('Personel', 'GIDER'), ('Vergi ve SGK', 'GIDER'),
  ('Banka masrafı ve komisyon', 'GIDER'), ('Kargo ve nakliye', 'GIDER'), ('Diğer gider', 'GIDER'),
  ('Faiz geliri', 'GELIR'), ('Diğer gelir', 'GELIR');
