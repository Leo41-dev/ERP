-- CreateEnum
CREATE TYPE "FiyatTipi" AS ENUM ('SABIT', 'MARJ');

-- AlterTable
ALTER TABLE "Urun" ADD COLUMN     "fiyatTipi" "FiyatTipi" NOT NULL DEFAULT 'SABIT',
ADD COLUMN     "karOrani" DECIMAL(8,4);

-- CreateTable
CREATE TABLE "KdvOrani" (
    "id" SERIAL NOT NULL,
    "oran" DECIMAL(6,4) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KdvOrani_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KdvOrani_oran_key" ON "KdvOrani"("oran");


-- Bugüne kadar sabit olan KDV oranları
INSERT INTO "KdvOrani" ("oran") VALUES (0), (0.01), (0.1), (0.2);
