import { para } from "../normalize";
import { otvEk, satirVergi, type EkVergi } from "../vergiHesap";

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

export type OdemeSatiri = { yontem: "HAVALE" | "KART" | "NAKIT" | "SENET" | "CEK" | "DIGER"; tutar: number; taksit: number | null; vade: Date | null; aciklama: string | null; hesapId?: number | null };

export function odemeFarki(genelToplam: number, odemeler: OdemeSatiri[]) {
  const toplam = para(odemeler.reduce((t, o) => t + o.tutar, 0));
  return { toplam, fark: para(genelToplam - toplam) };
}

export type KalemGirdisi = { aciklama: string; miktar: number; birimFiyat: number; kdvOrani: number; otvOrani?: number; ekler?: EkVergi[]; urunId?: number | null }; // birim fiyat vergiler dahil; ÖTV ve ek vergiler ürün kartından

/** Hızlı satış kalemleri: KDV dahil birim fiyattan satır tutarı, KDV hariç birim fiyat ve KDV */
export function kalemHesapla(kalemler: KalemGirdisi[]) {
  const satirlar = kalemler.map((k) => {
    const tutar = para(k.miktar * k.birimFiyat);
    const otvOrani = k.otvOrani ?? 0;
    const v = satirVergi({ tutar, miktar: k.miktar, kdvOrani: k.kdvOrani, ekler: [...otvEk(otvOrani), ...(k.ekler ?? [])] });
    const otv = para(v.ekler.filter((x) => x.otv).reduce((t, x) => t + x.tutar, 0));
    return {
      ...k,
      otvOrani,
      tutar,
      matrah: v.matrah,
      otv,
      kdv: v.kdv,
      ekVergi: para(v.ekToplam - otv),
      kesinti: v.kesinti,
      vergiler: v.ekler.filter((x) => !x.otv), // ÖTV dışındaki ek vergi ve kesintiler, tutarlarıyla
      birimMatrah: k.miktar ? para(v.matrah / k.miktar) : 0,
    };
  });
  const toplam = (a: "tutar" | "matrah" | "otv" | "kdv" | "ekVergi" | "kesinti") => para(satirlar.reduce((t, s) => t + s[a], 0));
  const genelToplam = toplam("tutar"), kesinti = toplam("kesinti");
  // aynı adlı ek vergiler belge altında tek satır
  const vergiOzeti = new Map<string, { ad: string; tutar: number; kesinti: boolean }>();
  for (const s of satirlar) for (const x of s.vergiler) {
    const anahtar = `${x.ad}|${x.kesinti || x.hesap === "KDV_TEVKIFAT"}`;
    const e = vergiOzeti.get(anahtar) ?? { ad: x.ad, tutar: 0, kesinti: x.kesinti || x.hesap === "KDV_TEVKIFAT" };
    e.tutar = para(e.tutar + x.tutar);
    vergiOzeti.set(anahtar, e);
  }
  return { satirlar, genelToplam, matrah: toplam("matrah"), otv: toplam("otv"), kdv: toplam("kdv"), ekVergi: toplam("ekVergi"), kesinti, tahsilEdilecek: para(genelToplam - kesinti), vergiOzeti: [...vergiOzeti.values()] };
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
