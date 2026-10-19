// Örnek parça/aksesuar stoğu (`npm run demo:stok`): yalnızca hiç ürün kartı yokken çalışır.
// Demo veritabanının stok ekranları boş görünmesin diye; gerçek kurulumda kullanılmaz.
import { Prisma, PrismaClient, type UrunTur } from "@prisma/client";
import { stokHareketYaz } from "../src/lib/stok";

const dec = (n: number) => new Prisma.Decimal(n);
const gunOnce = (g: number) => new Date(Date.now() - g * 86_400_000);

// kod, ad, tür, grup, birim, raf, kritik, alış (KDV hariç), satış (KDV dahil), açılış, gelen, çıkan
const URUNLER: [string, string, UrunTur, string, string, string, number | null, number, number, number, number, number][] = [
  ["YP-00001", "MOTUL 7100 4T 10W40 1 LT", "YEDEK_PARCA", "YAĞ", "Adet", "A1", 24, 420, 690, 30, 48, 51],
  ["YP-00002", "MOTUL 7100 4T 10W50 4 LT", "YEDEK_PARCA", "YAĞ", "Adet", "A1", 6, 1550, 2450, 4, 12, 12],
  ["YP-00003", "CFMOTO YAĞ FİLTRESİ 0800-011300", "YEDEK_PARCA", "FİLTRE", "Adet", "B2", 10, 145, 320, 12, 20, 25],
  ["YP-00004", "BRP CAN-AM YAĞ FİLTRESİ 420956123", "YEDEK_PARCA", "FİLTRE", "Adet", "B2", 8, 360, 650, 6, 10, 9],
  ["YP-00005", "CFMOTO HAVA FİLTRESİ CFORCE 625", "YEDEK_PARCA", "FİLTRE", "Adet", "B3", 4, 520, 980, 3, 6, 6],
  ["YP-00006", "NGK BUJİ DCPR8E", "YEDEK_PARCA", "ATEŞLEME", "Adet", "B4", 12, 165, 340, 20, 0, 14],
  ["YP-00007", "ÖN FREN BALATASI CFORCE 450/625", "YEDEK_PARCA", "FREN", "Takım", "C1", 4, 690, 1250, 6, 4, 7],
  ["YP-00008", "ARKA FREN BALATASI CFORCE 450/625", "YEDEK_PARCA", "FREN", "Takım", "C1", 4, 640, 1150, 5, 0, 2],
  ["YP-00009", "CAN-AM V KAYIŞI 422280652", "YEDEK_PARCA", "AKTARMA", "Adet", "C3", 2, 4100, 6900, 3, 0, 2],
  ["YP-00010", "CFMOTO V KAYIŞI 0180-055000", "YEDEK_PARCA", "AKTARMA", "Adet", "C3", 2, 2650, 4500, 2, 2, 3],
  ["YP-00011", "YUASA YTX20L-BS AKÜ", "YEDEK_PARCA", "ELEKTRİK", "Adet", "D1", 3, 3200, 5200, 4, 3, 5],
  ["YP-00012", "MAXXIS BIGHORN 26X9-12 ÖN LASTİK", "YEDEK_PARCA", "LASTİK", "Adet", "E1", 4, 3900, 6400, 8, 0, 3],
  ["YP-00013", "MAXXIS BIGHORN 26X11-12 ARKA LASTİK", "YEDEK_PARCA", "LASTİK", "Adet", "E1", 4, 4200, 6900, 8, 0, 5],
  ["AK-00001", "WARN VRX 25 VİNÇ", "AKSESUAR", "VİNÇ", "Adet", "F1", 1, 14500, 23900, 2, 2, 2],
  ["AK-00002", "KAR KÜREĞİ SETİ 152 CM", "AKSESUAR", "KAR EKİPMANI", "Takım", "F2", 1, 16800, 27500, 1, 3, 1],
  ["AK-00003", "ARKA ÇANTA 124 LT", "AKSESUAR", "ÇANTA", "Adet", "F3", 2, 4300, 7400, 3, 2, 3],
  ["AK-00004", "KASK MX SİYAH L", "AKSESUAR", "EKİPMAN", "Adet", "G1", 2, 2400, 4200, 5, 0, 3],
  ["AK-00005", "KASK MX SİYAH M", "AKSESUAR", "EKİPMAN", "Adet", "G1", 2, 2400, 4200, 4, 0, 1],
  ["AK-00006", "MX GÖZLÜK ŞEFFAF CAM", "AKSESUAR", "EKİPMAN", "Adet", "G2", 3, 650, 1250, 10, 0, 6],
  ["AK-00007", "MX ELDİVEN L", "AKSESUAR", "EKİPMAN", "Çift", "G2", 4, 480, 950, 12, 0, 9],
  ["AK-00008", "EL KORUMA (HANDGUARD) SETİ", "AKSESUAR", "KORUMA", "Takım", "F4", 2, 1650, 2950, 4, 0, 2],
  ["AK-00009", "LED SİS FARI SETİ", "AKSESUAR", "AYDINLATMA", "Takım", "F4", 2, 1900, 3400, 2, 2, 4],
  ["DG-00001", "ZİNCİR VE GRES SPREYİ 400 ML", "DIGER", "SARF", "Adet", "A2", 10, 210, 420, 24, 0, 18],
  ["DG-00002", "RADYATÖR SUYU (ANTİFRİZ) 3 LT", "DIGER", "SARF", "Adet", "A2", 6, 280, 520, 10, 12, 18],
];
const HIZMETLER: [string, string, number][] = [["HZ-00001", "PERİYODİK BAKIM İŞÇİLİĞİ", 3500], ["HZ-00002", "LASTİK MONTAJ VE BALANS (4 TEKER)", 1200], ["HZ-00003", "AKSESUAR MONTAJ İŞÇİLİĞİ (SAAT)", 900]];

async function main() {
  const db = new PrismaClient();
  try {
    if ((await db.urun.count()) > 0) return console.log("Örnek stok atlandı: ürün kartları zaten var.");
    await db.$transaction(async (tx) => {
      const ted = await tx.cari.create({ data: { unvan: "ÖRNEK MOTOR PARÇA TİC. LTD. ŞTİ.", tip: "KURUMSAL", rol: "TEDARIKCI", not: "Demo verisi" } });
      const gelenler: { urunId: number; miktar: number; fiyat: number }[] = [];
      const cikanlar: { urunId: number; miktar: number }[] = [];
      for (const [i, [kod, ad, tur, grup, birim, raf, kritik, alis, satis, acilis, gelen, cikan]] of URUNLER.entries()) {
        const u = await tx.urun.create({
          data: { kod, ad, tur, grup, birim, raf, kritikStok: kritik === null ? null : dec(kritik), alisFiyati: dec(alis), satisFiyati: dec(satis), kdvDahil: true, kdvOrani: dec(0.2), barkod: `2000000${String(i + 1).padStart(5, "0")}` },
        });
        await stokHareketYaz(tx, { urunId: u.id, tur: "ACILIS", miktar: acilis, birimMaliyet: alis * 0.95, tarih: gunOnce(60), aciklama: "Açılış stoğu", kaydeden: "Demo" });
        if (gelen) gelenler.push({ urunId: u.id, miktar: gelen, fiyat: alis });
        if (cikan) cikanlar.push({ urunId: u.id, miktar: cikan });
      }
      const ara = gelenler.reduce((t, x) => t + x.miktar * x.fiyat, 0);
      const g = await tx.stokGiris.create({
        data: { tedarikciId: ted.id, faturaNo: "ORN2026000000042", tarih: gunOnce(20), araToplam: dec(ara), kdvToplam: dec(ara * 0.2), genelToplam: dec(ara * 1.2), kaynak: "ELLE", kaydeden: "Demo", not: "Demo verisi" },
      });
      for (const [i, x] of gelenler.entries()) {
        await tx.stokGirisKalemi.create({ data: { girisId: g.id, sira: i + 1, urunId: x.urunId, miktar: dec(x.miktar), birimFiyat: dec(x.fiyat), kdvOrani: dec(0.2), tutar: dec(x.miktar * x.fiyat) } });
        await stokHareketYaz(tx, { urunId: x.urunId, tur: "ALIS", miktar: x.miktar, birimMaliyet: x.fiyat, tarih: gunOnce(20), stokGirisId: g.id, kaydeden: "Demo" });
      }
      // geçmiş satışlar ve servis kullanımı tek bir çıkışla özetlenir; hareket dökümü dolu görünsün diye
      for (const x of cikanlar) await stokHareketYaz(tx, { urunId: x.urunId, tur: "CIKIS", miktar: -x.miktar, tarih: gunOnce(5), aciklama: "Demo: önceki satışlar ve servis kullanımı", kaydeden: "Demo" });
      for (const [kod, ad, fiyat] of HIZMETLER) await tx.urun.create({ data: { kod, ad, tur: "HIZMET", grup: "SERVİS", birim: "Adet", satisFiyati: dec(fiyat), kdvDahil: true, kdvOrani: dec(0.2) } });
    }, { timeout: 60_000 });
    console.log(`Örnek stok yüklendi (${URUNLER.length} ürün, ${HIZMETLER.length} hizmet).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
