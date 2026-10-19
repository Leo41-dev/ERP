-- AlterTable
ALTER TABLE "Urun" ADD COLUMN     "grupId" INTEGER,
ADD COLUMN     "markaId" INTEGER;

-- CreateTable
CREATE TABLE "UrunGrubu" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UrunGrubu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrunMarkasi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UrunMarkasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrunGrubu_ad_key" ON "UrunGrubu"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "UrunMarkasi_ad_key" ON "UrunMarkasi"("ad");

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "UrunGrubu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_markaId_fkey" FOREIGN KEY ("markaId") REFERENCES "UrunMarkasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mevcut serbest yazılmış grup adları tanım tablosuna taşınır
INSERT INTO "UrunGrubu" ("ad") SELECT DISTINCT upper(trim("grup")) FROM "Urun" WHERE "grup" IS NOT NULL AND trim("grup") <> '';
UPDATE "Urun" u SET "grupId" = g."id" FROM "UrunGrubu" g WHERE upper(trim(u."grup")) = g."ad";
ALTER TABLE "Urun" DROP COLUMN "grup";
