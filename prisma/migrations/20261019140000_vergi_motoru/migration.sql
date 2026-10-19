-- CreateEnum
CREATE TYPE "VergiHesap" AS ENUM ('YUZDE', 'BIRIM_TUTAR', 'SABIT_TUTAR', 'KDV_TEVKIFAT');

-- AlterTable
ALTER TABLE "Satis" ADD COLUMN     "ekVergiToplam" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "kesintiToplam" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VergiTanimi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT,
    "hesap" "VergiHesap" NOT NULL,
    "deger" DECIMAL(12,4) NOT NULL,
    "kdvMatrahina" BOOLEAN NOT NULL DEFAULT false,
    "kesinti" BOOLEAN NOT NULL DEFAULT false,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VergiTanimi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrunVergi" (
    "urunId" INTEGER NOT NULL,
    "vergiId" INTEGER NOT NULL,
    "deger" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "UrunVergi_pkey" PRIMARY KEY ("urunId","vergiId")
);

-- CreateTable
CREATE TABLE "SatisKalemiVergi" (
    "id" SERIAL NOT NULL,
    "kalemId" INTEGER NOT NULL,
    "vergiId" INTEGER,
    "ad" TEXT NOT NULL,
    "kod" TEXT,
    "hesap" "VergiHesap" NOT NULL,
    "deger" DECIMAL(12,4) NOT NULL,
    "kdvMatrahina" BOOLEAN NOT NULL,
    "kesinti" BOOLEAN NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SatisKalemiVergi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VergiTanimi_ad_key" ON "VergiTanimi"("ad");

-- AddForeignKey
ALTER TABLE "UrunVergi" ADD CONSTRAINT "UrunVergi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrunVergi" ADD CONSTRAINT "UrunVergi_vergiId_fkey" FOREIGN KEY ("vergiId") REFERENCES "VergiTanimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalemiVergi" ADD CONSTRAINT "SatisKalemiVergi_kalemId_fkey" FOREIGN KEY ("kalemId") REFERENCES "SatisKalemi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

