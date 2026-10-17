/**
 * Boş veritabanına başlangıç tanımlarını yazar: konumlar, ÖTV oranları, teslim kontrol listesi
 * ve ilk yönetici. Tekrar çalıştırmak güvenlidir; var olan kayıtlara dokunmaz.
 *
 * İlk yönetici için: ILK_YONETICI_KULLANICI, ILK_YONETICI_AD, ILK_YONETICI_SIFRE
 */
import { PrismaClient } from "@prisma/client";
import { sifreKurali, sifreOzetle } from "../src/lib/sifre";

const db = new PrismaClient();

const KONUMLAR = ["Başiskele", "Acısu", "Atölye"];
const OTV_ORANLARI = [0, 0.03, 0.04, 0.08, 0.25, 0.37, 0.7, 0.8];
// eski satış panelindeki liste
const KONTROL_MADDELERI = [
  "Sıvı kontrolleri",
  "Araç çalıştırma ve fonksiyon kontrolleri",
  "Dış görsellik ve kozmetik kontrolleri",
  "Test sürüşü kontrolleri",
  "Debriyaj, gaz ve rot ayarı kontrolleri",
  "Akü ve elektrik aksam kontrolleri",
  "Akü şase kablosu demonte kontrolü",
  "Lastik basınç kontrolleri",
  "Avadanlık, kitapçık, yedek anahtar kontrolleri",
  "Yakıt ikmali",
  "Yıkama ve temizlik",
];

async function main() {
  for (const ad of KONUMLAR) await db.konum.upsert({ where: { ad }, update: {}, create: { ad } });
  for (const oran of OTV_ORANLARI) await db.otvOrani.upsert({ where: { oran }, update: {}, create: { oran } });
  if ((await db.kontrolMaddesi.count()) === 0) {
    await db.kontrolMaddesi.createMany({ data: KONTROL_MADDELERI.map((ad, i) => ({ ad, sira: i + 1 })) });
  }

  if ((await db.kullanici.count({ where: { rol: "YONETICI" } })) === 0) {
    const kullaniciAdi = process.env.ILK_YONETICI_KULLANICI?.trim().toLowerCase();
    const adSoyad = process.env.ILK_YONETICI_AD?.trim() || "Yönetici";
    const sifre = process.env.ILK_YONETICI_SIFRE ?? "";
    if (!kullaniciAdi) {
      console.log("Yönetici yok. ILK_YONETICI_KULLANICI ve ILK_YONETICI_SIFRE verip tekrar çalıştırın.");
    } else {
      const hata = sifreKurali(sifre);
      if (hata) throw new Error(`ILK_YONETICI_SIFRE: ${hata}`);
      await db.kullanici.create({ data: { kullaniciAdi, adSoyad, rol: "YONETICI", sifreOzet: await sifreOzetle(sifre) } });
      console.log(`İlk yönetici oluşturuldu: ${kullaniciAdi}`);
    }
  }
  console.log("Başlangıç verisi hazır.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
