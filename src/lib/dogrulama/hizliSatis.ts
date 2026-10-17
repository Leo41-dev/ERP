import { oran, sayi, telefon as telefonNormalize } from "../normalize";
import type { KalemGirdisi, OdemeSatiri } from "../satis/hesap";
import type { Hatalar } from "./cari";
import { odemeSatirlari } from "./satis";

export type HizliSatisVeri = {
  firmaId: number | null;
  kalemler: KalemGirdisi[];
  odemeler: OdemeSatiri[];
  musteri: { kimlikNo: string; unvan: string; telefon: string };
  not: string | null;
};

/** Kalem satırları: kalem_aciklama, kalem_miktar, kalem_fiyat (KDV dahil birim), kalem_kdv */
export function hizliSatisDogrula(f: FormData): { veri: HizliSatisVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const aciklamalar = f.getAll("kalem_aciklama").map(String);
  const miktarlar = f.getAll("kalem_miktar").map(String);
  const fiyatlar = f.getAll("kalem_fiyat").map(String);
  const kdvler = f.getAll("kalem_kdv").map(String);
  const kalemler: KalemGirdisi[] = [];
  aciklamalar.forEach((a, i) => {
    const aciklama = a.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
    const fiyatHam = (fiyatlar[i] ?? "").trim();
    if (!aciklama && !fiyatHam) return;
    const miktar = sayi(miktarlar[i] || "1");
    const birimFiyat = sayi(fiyatHam);
    const kdvOrani = oran(kdvler[i] ?? "0.2");
    if (!aciklama) h.kalemler = `${i + 1}. satırda ürün/hizmet adı yazılmalı.`;
    else if (!miktar || miktar <= 0) h.kalemler = `${i + 1}. satırda adet geçersiz.`;
    else if (!birimFiyat || birimFiyat <= 0) h.kalemler = `${i + 1}. satırda fiyat geçersiz.`;
    else if (kdvOrani === null) h.kalemler = `${i + 1}. satırda KDV oranı geçersiz.`;
    else kalemler.push({ aciklama, miktar, birimFiyat, kdvOrani });
  });
  if (!kalemler.length && !h.kalemler) h.kalemler = "En az bir ürün ya da hizmet girilmeli.";

  const odemeler = odemeSatirlari(f, h);
  if (!odemeler.length && !h.odemeler) h.odemeler = "Ödeme girilmeli.";

  const kimlikNo = s("kimlikNo").replace(/\D/g, "");
  if (kimlikNo && kimlikNo.length !== 10 && kimlikNo.length !== 11) h.kimlikNo = "TCKN 11, VKN 10 haneli olmalı.";
  const telefon = s("telefon") ? telefonNormalize(s("telefon")) ?? "" : "";
  if (s("telefon") && !telefon) h.telefon = "Telefon 10 haneli olmalı (5xx xxx xx xx).";
  const unvan = s("unvan").replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  if ((kimlikNo || telefon) && !unvan) h.unvan = "Kimlik ya da telefon girildiyse ad soyad da yazılmalı.";

  return {
    veri: { firmaId: Number(s("firmaId")) || null, kalemler, odemeler, musteri: { kimlikNo, unvan, telefon }, not: s("not") || null },
    hatalar: h,
  };
}
