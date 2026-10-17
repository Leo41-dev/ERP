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

export type OdemeSatiri = { yontem: "HAVALE" | "KART" | "NAKIT" | "SENET" | "CEK" | "DIGER"; tutar: number; taksit: number | null; aciklama: string | null };

export function odemeFarki(genelToplam: number, odemeler: OdemeSatiri[]) {
  const toplam = para(odemeler.reduce((t, o) => t + o.tutar, 0));
  return { toplam, fark: para(genelToplam - toplam) };
}
