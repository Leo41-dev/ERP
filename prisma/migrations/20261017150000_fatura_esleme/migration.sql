-- CreateTable
CREATE TABLE "FaturaEsleme" (
    "anahtar" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "guncelleme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaturaEsleme_pkey" PRIMARY KEY ("anahtar")
);

-- AddForeignKey
ALTER TABLE "FaturaEsleme" ADD CONSTRAINT "FaturaEsleme_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AracModeli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
