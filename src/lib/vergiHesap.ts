import { para } from "./normalize";

/**
 * Vergi motoru (saf). Satır tutarı vergiler dahil girilir; matrah ve her verginin tutarı geriye doğru çıkarılır.
 *
 * Vergi türleri (Ayarlar → Satış → Vergi tanımları):
 * - YUZDE: matrahın yüzdesi (ÖTV, ÖİV, konaklama vergisi; damga vergisi binde oranı yüzdeye çevrilerek)
 * - BIRIM_TUTAR: miktar başına sabit tutar (maktu ÖTV gibi)
 * - SABIT_TUTAR: satır başına sabit tutar
 * - KDV_TEVKIFAT: KDV'nin bir kısmı (5/10 → 0,5); faturada görünür, alıcı öder, tahsil edilecekten düşer
 * kdvMatrahina: KDV bu verginin üzerinden de hesaplanır (ÖTV böyledir).
 * kesinti: toplamı değiştirmez, tahsil edilecek tutardan düşülür (stopaj, tevkifat).
 */

export type VergiHesapTuru = "YUZDE" | "BIRIM_TUTAR" | "SABIT_TUTAR" | "KDV_TEVKIFAT";
export type EkVergi = { ad: string; hesap: VergiHesapTuru; deger: number; kdvMatrahina: boolean; kesinti: boolean; vergiId?: number | null; kod?: string | null; otv?: boolean };

/** ÖTV de bir ek vergidir: matrahın yüzdesi, KDV matrahına girer */
export const otvEk = (oran: number): EkVergi[] => (oran > 0 ? [{ ad: "ÖTV", hesap: "YUZDE", deger: oran, kdvMatrahina: true, kesinti: false, otv: true }] : []);
export type SatirVergiGirdisi = { tutar: number; miktar: number; kdvOrani: number; ekler?: EkVergi[] };
export type SatirVergiSonucu = {
  matrah: number;
  kdv: number;
  ekler: (EkVergi & { tutar: number })[];
  ekToplam: number; // toplama giren ek vergiler
  kesinti: number; // tahsil edilecekten düşülenler
  tahsilEdilecek: number;
};

const eklenen = (v: EkVergi, miktar: number) => (v.hesap === "BIRIM_TUTAR" ? v.deger * miktar : v.hesap === "SABIT_TUTAR" ? v.deger : 0);

export function satirVergi({ tutar, miktar, kdvOrani, ekler = [] }: SatirVergiGirdisi): SatirVergiSonucu {
  // tutar = (M·(1+a) + b)·(1+k) + M·c + d   →   M çözülür
  // a, c: KDV matrahına giren / girmeyen yüzdeler; b, d: aynı ayrımla tutar bazlı vergiler. Kesintiler toplama girmez.
  const toplamaGiren = ekler.filter((v) => !v.kesinti && v.hesap !== "KDV_TEVKIFAT");
  const a = toplamaGiren.filter((v) => v.hesap === "YUZDE" && v.kdvMatrahina).reduce((t, v) => t + v.deger, 0);
  const c = toplamaGiren.filter((v) => v.hesap === "YUZDE" && !v.kdvMatrahina).reduce((t, v) => t + v.deger, 0);
  const b = toplamaGiren.filter((v) => v.hesap !== "YUZDE" && v.kdvMatrahina).reduce((t, v) => t + eklenen(v, miktar), 0);
  const d = toplamaGiren.filter((v) => v.hesap !== "YUZDE" && !v.kdvMatrahina).reduce((t, v) => t + eklenen(v, miktar), 0);
  const k = kdvOrani;
  const matrahHam = Math.max(0, (tutar - b * (1 + k) - d) / ((1 + a) * (1 + k) + c));

  const satirlar = ekler.map((v) => ({ ...v, tutar: v.hesap === "YUZDE" ? para(matrahHam * v.deger) : v.hesap === "KDV_TEVKIFAT" ? 0 : para(eklenen(v, miktar)) }));
  const kdvMatrahi = matrahHam + satirlar.filter((v) => !v.kesinti && v.kdvMatrahina && v.hesap !== "KDV_TEVKIFAT").reduce((t, v) => t + v.tutar, 0);
  const kdv = para(kdvMatrahi * k);
  for (const v of satirlar) if (v.hesap === "KDV_TEVKIFAT") v.tutar = para(kdv * v.deger);
  const ekToplam = para(satirlar.filter((v) => !v.kesinti && v.hesap !== "KDV_TEVKIFAT").reduce((t, v) => t + v.tutar, 0));
  // kuruş farkı matraha yazılır ki matrah + vergiler tutarı tam versin
  const matrah = para(tutar - kdv - ekToplam);
  const kesinti = para(satirlar.filter((v) => v.kesinti || v.hesap === "KDV_TEVKIFAT").reduce((t, v) => t + v.tutar, 0));
  return { matrah, kdv, ekler: satirlar, ekToplam, kesinti, tahsilEdilecek: para(tutar - kesinti) };
}

/** Kâr oranıyla fiyatta: matrahtan vergiler dahil birim fiyat (kesintiler fiyata girmez) */
export function vergilerDahil(matrah: number, miktar: number, kdvOrani: number, ekler: EkVergi[] = []) {
  const giren = ekler.filter((v) => !v.kesinti && v.hesap !== "KDV_TEVKIFAT");
  const tutar = (v: EkVergi) => (v.hesap === "YUZDE" ? matrah * v.deger : eklenen(v, miktar));
  const kdvMatrahi = matrah + giren.filter((v) => v.kdvMatrahina).reduce((t, v) => t + tutar(v), 0);
  return para(kdvMatrahi * (1 + kdvOrani) + giren.filter((v) => !v.kdvMatrahina).reduce((t, v) => t + tutar(v), 0));
}

export const VERGI_HESAP_AD: Record<VergiHesapTuru, string> = {
  YUZDE: "Matrahın yüzdesi",
  BIRIM_TUTAR: "Miktar başına tutar",
  SABIT_TUTAR: "Satır başına sabit tutar",
  KDV_TEVKIFAT: "KDV tevkifatı",
};

/** Oranlar kesir olarak saklanır (0,02); ekranda yüzde, tevkifatta "5/10" gibi gösterilir */
export function vergiDegerYazi(hesap: VergiHesapTuru, deger: number) {
  const onda = Math.round(deger * 10 * 1e6) / 1e6;
  if (hesap === "KDV_TEVKIFAT") return Number.isInteger(onda) ? `${onda}/10` : `%${(deger * 100).toLocaleString("tr-TR")}`;
  if (hesap === "YUZDE") return `%${(deger * 100).toLocaleString("tr-TR", { maximumFractionDigits: 4 })}`;
  return `${deger.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} ₺${hesap === "BIRIM_TUTAR" ? " / birim" : ""}`;
}

/** Formdan gelen değer: yüzde/tevkifat yüzde olarak yazılır (%2 → 0,02), tutarlar TL */
export const vergiDegerOku = (hesap: VergiHesapTuru, yazilan: number) => (hesap === "YUZDE" || hesap === "KDV_TEVKIFAT" ? yazilan / 100 : yazilan);
export const vergiDegerYaz = (hesap: VergiHesapTuru, deger: number) => (hesap === "YUZDE" || hesap === "KDV_TEVKIFAT" ? Math.round(deger * 1_000_000) / 10_000 : deger);

/** Ad ve değer birlikte; adı değeri zaten içeriyorsa ("KDV tevkifatı 5/10") tekrar yazılmaz */
export function vergiEtiketi(v: { ad: string; hesap: VergiHesapTuru; deger: number }) {
  const d = vergiDegerYazi(v.hesap, v.deger);
  return v.ad.includes(d) ? v.ad : `${v.ad} ${d}`;
}
