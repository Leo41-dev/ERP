-- CreateEnum
CREATE TYPE "TeklifDurum" AS ENUM ('ACIK', 'KABUL', 'RET');

-- CreateTable
CREATE TABLE "Teklif" (
    "id" SERIAL NOT NULL,
    "teklifNo" SERIAL NOT NULL,
    "firmaId" INTEGER,
    "cariId" INTEGER,
    "musteriAd" TEXT NOT NULL,
    "telefon" TEXT,
    "eposta" TEXT,
    "kimlikNo" TEXT,
    "saticiId" INTEGER,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gecerlilik" DATE NOT NULL,
    "durum" "TeklifDurum" NOT NULL DEFAULT 'ACIK',
    "araToplam" DECIMAL(14,2) NOT NULL,
    "otvToplam" DECIMAL(14,2) NOT NULL,
    "kdvToplam" DECIMAL(14,2) NOT NULL,
    "genelToplam" DECIMAL(14,2) NOT NULL,
    "odemeKosullari" TEXT,
    "not" TEXT,
    "retNedeni" TEXT,
    "satisId" INTEGER,
    "guncelleme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teklif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeklifKalemi" (
    "id" SERIAL NOT NULL,
    "teklifId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "modelId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(14,3) NOT NULL,
    "birimFiyat" DECIMAL(14,2) NOT NULL,
    "otvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0.2,
    "tutar" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "TeklifKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teklif_teklifNo_key" ON "Teklif"("teklifNo");

-- CreateIndex
CREATE UNIQUE INDEX "Teklif_satisId_key" ON "Teklif"("satisId");

-- CreateIndex
CREATE INDEX "Teklif_durum_tarih_idx" ON "Teklif"("durum", "tarih");

-- CreateIndex
CREATE INDEX "Teklif_telefon_idx" ON "Teklif"("telefon");

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_saticiId_fkey" FOREIGN KEY ("saticiId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AracModeli"("id") ON DELETE SET NULL ON UPDATE CASCADE;

