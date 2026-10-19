import { para } from "../normalize";

/**
 * Elle girilen KDV dahil toplamdan vergi kırılımını çıkarır.
 * Sıra: matrah → ÖTV (matrah üzerinden) → KDV (matrah + ÖTV üzerinden).
 */
export function vergiKirilimi(genelToplam: number, kdvOrani: number, otvOrani: number) {
  const kdvMatrahi = genelToplam / (1 + kdvOrani);
  const matrah = kdvMatrahi / (1 + otvOrani);
  const otv = para(kdvMatrahi - matrah);
  const kdv = para(genelToplam - kdvMatrahi);
  return { matrah: para(genelToplam - otv - kdv), otv, kdv };
}

export type OdemeSatiri = { yontem: "HAVALE" | "KART" | "NAKIT" | "SENET" | "CEK" | "DIGER"; tutar: number; taksit: number | null; vade: Date | null; aciklama: string | null };

export function odemeFarki(genelToplam: number, odemeler: OdemeSatiri[]) {
  const toplam = para(odemeler.reduce((t, o) => t + o.tutar, 0));
  return { toplam, fark: para(genelToplam - toplam) };
}

export type KalemGirdisi = { aciklama: string; miktar: number; birimFiyat: number; kdvOrani: number; urunId?: number | null }; // birim fiyat KDV dahil

/** Hızlı satış kalemleri: KDV dahil birim fiyattan satır tutarı, KDV hariç birim fiyat ve KDV */
export function kalemHesapla(kalemler: KalemGirdisi[]) {
  const satirlar = kalemler.map((k) => {
    const tutar = para(k.miktar * k.birimFiyat);
    const matrah = para(tutar / (1 + k.kdvOrani));
    return { ...k, tutar, matrah, kdv: para(tutar - matrah), birimMatrah: para(k.birimFiyat / (1 + k.kdvOrani)) };
  });
  const toplam = (a: "tutar" | "matrah" | "kdv") => para(satirlar.reduce((t, s) => t + s[a], 0));
  return { satirlar, genelToplam: toplam("tutar"), matrah: toplam("matrah"), kdv: toplam("kdv") };
}

export type TeklifKalemGirdisi = { aciklama: string; modelId: number | null; miktar: number; birimFiyat: number; kdvOrani: number; otvOrani: number }; // birim fiyat vergiler dahil

/** Teklif kalemleri: vergiler dahil birim fiyattan satır tutarı ve satır bazında ÖTV/KDV kırılımı */
export function teklifHesapla(kalemler: TeklifKalemGirdisi[]) {
  const satirlar = kalemler.map((k) => {
    const tutar = para(k.miktar * k.birimFiyat);
    return { ...k, tutar, ...vergiKirilimi(tutar, k.kdvOrani, k.otvOrani) };
  });
  const toplam = (a: "tutar" | "matrah" | "otv" | "kdv") => para(satirlar.reduce((t, s) => t + s[a], 0));
  return { satirlar, genelToplam: toplam("tutar"), matrah: toplam("matrah"), otv: toplam("otv"), kdv: toplam("kdv") };
}
