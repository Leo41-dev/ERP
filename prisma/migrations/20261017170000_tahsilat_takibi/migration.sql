-- AlterTable
ALTER TABLE "Tahsilat" ADD COLUMN     "iptalEden" TEXT,
ADD COLUMN     "iptalNedeni" TEXT,
ADD COLUMN     "iptalZamani" TIMESTAMP(3),
ADD COLUMN     "tahsilTarihi" DATE;

-- CreateIndex
CREATE INDEX "Tahsilat_yontem_vade_idx" ON "Tahsilat"("yontem", "vade");

