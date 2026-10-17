import "server-only";
import { db } from "./db";

/** Yazdırılan belgelerde Ayarlar'dan değiştirilebilen başlık ve metinler; boş bırakılan alan varsayılana döner. */
export const BELGE_AYARLARI = {
  "belge.baslik": { ad: "Belge üst başlığı", varsayilan: "KARTEPE ATV MOTORLU ARAÇLAR", cokSatir: false },
  "belge.satisFormuBaslik": { ad: "Satış formu başlığı", varsayilan: "CARİ HESAP TANIMLAMA VE SATIŞ FORMU", cokSatir: false },
  "belge.pdiBaslik": { ad: "PDI başlığı", varsayilan: "ARAÇ TESLİM VE SON KONTROL LİSTESİ", cokSatir: false },
  "belge.satisFormuNotu": { ad: "Satış formu alt metni", varsayilan: "", cokSatir: true },
  "belge.teslimBeyani": {
    ad: "Teslim beyanı (PDI)",
    varsayilan:
      "Yukarıda şase ve model bilgileri yazılı aracı; görsel, mekanik ve donanım olarak eksiksiz, hasarsız ve çalışır durumda, yedek anahtarı ve kitapçıklarıyla birlikte teslim aldım.",
    cokSatir: true,
  },
  "belge.fisBaslik": { ad: "Hızlı satış fişi başlığı", varsayilan: "SATIŞ FİŞİ", cokSatir: false },
  "belge.fisNotu": { ad: "Hızlı satış fişi alt metni", varsayilan: "Bu fiş bilgi amaçlıdır; faturanız ayrıca düzenlenir. Teşekkür ederiz.", cokSatir: true },
  "belge.teklifBaslik": { ad: "Teklif başlığı", varsayilan: "FİYAT TEKLİFİ", cokSatir: false },
  "belge.teklifNotu": {
    ad: "Teklif alt metni",
    varsayilan: "Fiyatlarımıza KDV ve ÖTV dahildir. Teklif, geçerlilik tarihine kadar ve stok durumuna bağlı olarak geçerlidir.",
    cokSatir: true,
  },
  "belge.teklifGun": { ad: "Teklif geçerlilik süresi (gün)", varsayilan: "7", cokSatir: false },
  "belge.kontrolEden": { ad: "Varsayılan kontrol eden", varsayilan: "", cokSatir: false },
} as const;

export type BelgeAyarAnahtari = keyof typeof BELGE_AYARLARI;
export type BelgeAyarlari = Record<BelgeAyarAnahtari, string>;

export async function belgeAyarlari(): Promise<BelgeAyarlari> {
  const kayitlar = await db.ayar.findMany({ where: { anahtar: { startsWith: "belge." } } });
  const sonuc = Object.fromEntries(Object.entries(BELGE_AYARLARI).map(([a, t]) => [a, t.varsayilan])) as BelgeAyarlari;
  for (const k of kayitlar) if (k.anahtar in sonuc && k.deger.trim()) sonuc[k.anahtar as BelgeAyarAnahtari] = k.deger;
  return sonuc;
}
