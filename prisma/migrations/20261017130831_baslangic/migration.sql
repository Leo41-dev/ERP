-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('YONETICI', 'SATIS', 'DEPO', 'SERVIS', 'MUHASEBE');

-- CreateEnum
CREATE TYPE "CariTip" AS ENUM ('BIREYSEL', 'KURUMSAL');

-- CreateEnum
CREATE TYPE "CariRol" AS ENUM ('MUSTERI', 'TEDARIKCI', 'MUSTERI_TEDARIKCI');

-- CreateEnum
CREATE TYPE "UrunTur" AS ENUM ('ARAC', 'YEDEK_PARCA', 'AKSESUAR', 'HIZMET', 'DIGER');

-- CreateEnum
CREATE TYPE "ParaBirimi" AS ENUM ('TRY', 'EUR', 'USD');

-- CreateEnum
CREATE TYPE "Kondisyon" AS ENUM ('SIFIR', 'IKINCI_EL', 'KONSINYE');

-- CreateEnum
CREATE TYPE "AracDurum" AS ENUM ('STOKTA', 'REZERVE', 'SATILDI', 'IADE');

-- CreateEnum
CREATE TYPE "TescilDurum" AS ENUM ('TESCILSIZ', 'BASVURUDA', 'TESCILLI');

-- CreateEnum
CREATE TYPE "MaliyetTur" AS ENUM ('ALIS', 'OTV', 'KDV_FARKI', 'AKSESUAR', 'POS', 'NAKLIYE', 'DIGER');

-- CreateEnum
CREATE TYPE "StokHareketTur" AS ENUM ('ACILIS', 'ALIS', 'SATIS', 'IADE', 'SAYIM');

-- CreateEnum
CREATE TYPE "SatisDurum" AS ENUM ('TASLAK', 'KAYITLI', 'FATURALANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "OdemeYontem" AS ENUM ('HAVALE', 'KART', 'NAKIT', 'SENET', 'CEK', 'DIGER');

-- CreateTable
CREATE TABLE "Firma" (
    "id" SERIAL NOT NULL,
    "unvan" TEXT NOT NULL,
    "vkn" TEXT NOT NULL,
    "vergiDairesi" TEXT,
    "adres" TEXT,
    "varsayilan" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" SERIAL NOT NULL,
    "kullaniciAdi" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "eposta" TEXT,
    "sifreOzet" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'SATIS',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" TIMESTAMP(3),
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Konum" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Konum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtvOrani" (
    "id" SERIAL NOT NULL,
    "oran" DECIMAL(6,4) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OtvOrani_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AracTipi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "varsayilanOtvOrani" DECIMAL(6,4),

    CONSTRAINT "AracTipi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marka" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "iskontoOrani" DECIMAL(6,4),

    CONSTRAINT "Marka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AracModeli" (
    "id" SERIAL NOT NULL,
    "markaId" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "altModel" TEXT NOT NULL DEFAULT '',
    "tipId" INTEGER,

    CONSTRAINT "AracModeli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DovizKuru" (
    "id" SERIAL NOT NULL,
    "paraBirimi" "ParaBirimi" NOT NULL,
    "tarih" DATE NOT NULL,
    "kur" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "DovizKuru_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KontrolMaddesi" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KontrolMaddesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cari" (
    "id" SERIAL NOT NULL,
    "tip" "CariTip" NOT NULL DEFAULT 'BIREYSEL',
    "rol" "CariRol" NOT NULL DEFAULT 'MUSTERI',
    "unvan" TEXT NOT NULL,
    "tckn" TEXT,
    "vkn" TEXT,
    "vergiDairesi" TEXT,
    "tckkSeriNo" TEXT,
    "dogumTarihi" DATE,
    "telefon" TEXT,
    "telefon2" TEXT,
    "eposta" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "acikAdres" TEXT,
    "eTebligat" BOOLEAN NOT NULL DEFAULT false,
    "kvkkOnay" BOOLEAN NOT NULL DEFAULT false,
    "not" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "borc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "alacak" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "satisId" INTEGER,
    "tahsilatId" INTEGER,

    CONSTRAINT "CariHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Urun" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "grup" TEXT,
    "tur" "UrunTur" NOT NULL,
    "birim" TEXT NOT NULL DEFAULT 'Adet',
    "barkod" TEXT,
    "kdvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0.2,
    "otvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "alisFiyati" DECIMAL(14,2),
    "satisFiyati" DECIMAL(14,2),
    "kdvDahil" BOOLEAN NOT NULL DEFAULT false,
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "raf" TEXT,
    "kritikStok" DECIMAL(14,3),
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Urun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokHareketi" (
    "id" SERIAL NOT NULL,
    "urunId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "StokHareketTur" NOT NULL,
    "miktar" DECIMAL(14,3) NOT NULL,
    "satisId" INTEGER,
    "aciklama" TEXT,

    CONSTRAINT "StokHareketi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arac" (
    "id" SERIAL NOT NULL,
    "sase" TEXT NOT NULL,
    "motorNo" TEXT,
    "modelId" INTEGER,
    "yil" INTEGER,
    "renk" TEXT,
    "euroStandart" TEXT,
    "kondisyon" "Kondisyon" NOT NULL DEFAULT 'SIFIR',
    "durum" "AracDurum" NOT NULL DEFAULT 'STOKTA',
    "konumId" INTEGER,
    "gelisTarihi" DATE,
    "tedarikciId" INTEGER,
    "alisFaturaNo" TEXT,
    "alisSekli" TEXT,
    "kdvOrani" DECIMAL(6,4),
    "otvOrani" DECIMAL(6,4),
    "tescilDurum" "TescilDurum" NOT NULL DEFAULT 'TESCILSIZ',
    "plaka" TEXT,
    "ruhsatSeriNo" TEXT,
    "tescilTarihi" DATE,
    "not" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AracMaliyet" (
    "id" SERIAL NOT NULL,
    "aracId" INTEGER NOT NULL,
    "tur" "MaliyetTur" NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "aciklama" TEXT,

    CONSTRAINT "AracMaliyet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KonumTransferi" (
    "id" SERIAL NOT NULL,
    "aracId" INTEGER NOT NULL,
    "eskiKonumId" INTEGER,
    "yeniKonumId" INTEGER NOT NULL,
    "yapan" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KonumTransferi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Satis" (
    "id" SERIAL NOT NULL,
    "formNo" SERIAL NOT NULL,
    "firmaId" INTEGER,
    "cariId" INTEGER NOT NULL,
    "saticiId" INTEGER,
    "tarih" TIMESTAMP(3) NOT NULL,
    "durum" "SatisDurum" NOT NULL DEFAULT 'TASLAK',
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "kur" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "araToplam" DECIMAL(14,2),
    "iskontoToplam" DECIMAL(14,2),
    "otvToplam" DECIMAL(14,2),
    "kdvToplam" DECIMAL(14,2),
    "genelToplam" DECIMAL(14,2) NOT NULL,
    "teslimTarihi" DATE,
    "not" TEXT,
    "faturaNo" TEXT,
    "faturaTarihi" DATE,
    "eFaturaUuid" TEXT,
    "iptalNedeni" TEXT,
    "iptalEden" TEXT,
    "iptalZamani" TIMESTAMP(3),
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Satis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisKalemi" (
    "id" SERIAL NOT NULL,
    "satisId" INTEGER NOT NULL,
    "urunId" INTEGER,
    "aracId" INTEGER,
    "aciklama" TEXT NOT NULL,
    "miktar" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL(14,2) NOT NULL,
    "iskontoOrani" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "otvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "kdvOrani" DECIMAL(6,4) NOT NULL DEFAULT 0.2,
    "tutar" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SatisKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tahsilat" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "satisId" INTEGER,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yontem" "OdemeYontem" NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "taksit" INTEGER,
    "vade" DATE,
    "aciklama" TEXT,
    "kaydeden" TEXT,

    CONSTRAINT "Tahsilat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garanti" (
    "id" SERIAL NOT NULL,
    "aracId" INTEGER NOT NULL,
    "cariId" INTEGER NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE NOT NULL,
    "kapsam" TEXT,

    CONSTRAINT "Garanti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeslimKontrol" (
    "id" SERIAL NOT NULL,
    "satisId" INTEGER NOT NULL,
    "maddeler" JSONB NOT NULL,
    "kontrolEden" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeslimKontrol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisHedefi" (
    "id" SERIAL NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "ay" TEXT NOT NULL,
    "hedefAdet" INTEGER NOT NULL,
    "hedefCiro" DECIMAL(14,2) NOT NULL,
    "bazDonem" TEXT NOT NULL,

    CONSTRAINT "SatisHedefi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DenetimKaydi" (
    "id" SERIAL NOT NULL,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kullanici" TEXT,
    "islem" TEXT NOT NULL,
    "tablo" TEXT NOT NULL,
    "kayitId" TEXT,
    "detay" JSONB,

    CONSTRAINT "DenetimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Firma_vkn_key" ON "Firma"("vkn");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_kullaniciAdi_key" ON "Kullanici"("kullaniciAdi");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_eposta_key" ON "Kullanici"("eposta");

-- CreateIndex
CREATE UNIQUE INDEX "Konum_ad_key" ON "Konum"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "OtvOrani_oran_key" ON "OtvOrani"("oran");

-- CreateIndex
CREATE UNIQUE INDEX "AracTipi_ad_key" ON "AracTipi"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Marka_ad_key" ON "Marka"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "AracModeli_markaId_model_altModel_key" ON "AracModeli"("markaId", "model", "altModel");

-- CreateIndex
CREATE UNIQUE INDEX "DovizKuru_paraBirimi_tarih_key" ON "DovizKuru"("paraBirimi", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "KontrolMaddesi_ad_key" ON "KontrolMaddesi"("ad");

-- CreateIndex
CREATE INDEX "Cari_tckn_idx" ON "Cari"("tckn");

-- CreateIndex
CREATE INDEX "Cari_vkn_idx" ON "Cari"("vkn");

-- CreateIndex
CREATE INDEX "Cari_telefon_idx" ON "Cari"("telefon");

-- CreateIndex
CREATE INDEX "Cari_unvan_idx" ON "Cari"("unvan");

-- CreateIndex
CREATE UNIQUE INDEX "CariHareket_tahsilatId_key" ON "CariHareket"("tahsilatId");

-- CreateIndex
CREATE INDEX "CariHareket_cariId_tarih_idx" ON "CariHareket"("cariId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "Urun_kod_key" ON "Urun"("kod");

-- CreateIndex
CREATE INDEX "Urun_barkod_idx" ON "Urun"("barkod");

-- CreateIndex
CREATE INDEX "Urun_ad_idx" ON "Urun"("ad");

-- CreateIndex
CREATE INDEX "StokHareketi_urunId_tarih_idx" ON "StokHareketi"("urunId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_sase_key" ON "Arac"("sase");

-- CreateIndex
CREATE INDEX "Arac_durum_idx" ON "Arac"("durum");

-- CreateIndex
CREATE INDEX "Arac_plaka_idx" ON "Arac"("plaka");

-- CreateIndex
CREATE UNIQUE INDEX "Satis_formNo_key" ON "Satis"("formNo");

-- CreateIndex
CREATE UNIQUE INDEX "Satis_eFaturaUuid_key" ON "Satis"("eFaturaUuid");

-- CreateIndex
CREATE INDEX "Satis_tarih_idx" ON "Satis"("tarih");

-- CreateIndex
CREATE INDEX "Satis_durum_idx" ON "Satis"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "Garanti_aracId_key" ON "Garanti"("aracId");

-- CreateIndex
CREATE UNIQUE INDEX "TeslimKontrol_satisId_key" ON "TeslimKontrol"("satisId");

-- CreateIndex
CREATE UNIQUE INDEX "SatisHedefi_kullaniciId_ay_key" ON "SatisHedefi"("kullaniciId", "ay");

-- CreateIndex
CREATE INDEX "DenetimKaydi_tablo_kayitId_idx" ON "DenetimKaydi"("tablo", "kayitId");

-- AddForeignKey
ALTER TABLE "AracModeli" ADD CONSTRAINT "AracModeli_markaId_fkey" FOREIGN KEY ("markaId") REFERENCES "Marka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AracModeli" ADD CONSTRAINT "AracModeli_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "AracTipi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_tahsilatId_fkey" FOREIGN KEY ("tahsilatId") REFERENCES "Tahsilat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AracModeli"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_konumId_fkey" FOREIGN KEY ("konumId") REFERENCES "Konum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_tedarikciId_fkey" FOREIGN KEY ("tedarikciId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AracMaliyet" ADD CONSTRAINT "AracMaliyet_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KonumTransferi" ADD CONSTRAINT "KonumTransferi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KonumTransferi" ADD CONSTRAINT "KonumTransferi_eskiKonumId_fkey" FOREIGN KEY ("eskiKonumId") REFERENCES "Konum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KonumTransferi" ADD CONSTRAINT "KonumTransferi_yeniKonumId_fkey" FOREIGN KEY ("yeniKonumId") REFERENCES "Konum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_saticiId_fkey" FOREIGN KEY ("saticiId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalemi" ADD CONSTRAINT "SatisKalemi_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalemi" ADD CONSTRAINT "SatisKalemi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalemi" ADD CONSTRAINT "SatisKalemi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tahsilat" ADD CONSTRAINT "Tahsilat_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tahsilat" ADD CONSTRAINT "Tahsilat_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garanti" ADD CONSTRAINT "Garanti_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garanti" ADD CONSTRAINT "Garanti_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeslimKontrol" ADD CONSTRAINT "TeslimKontrol_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisHedefi" ADD CONSTRAINT "SatisHedefi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
