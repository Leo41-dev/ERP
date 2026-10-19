// Stok hesapları (saf). Veritabanı tarafı src/lib/stok.ts'de.

/** 3 haneli miktar yuvarlaması (0,001 hassasiyet) */
export const miktarYuvarla = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Ağırlıklı ortalama maliyet. Girişten önce stok sıfır ya da eksiyse eski ortalama anlamını yitirir,
 * yeni ortalama girişin birim maliyeti olur.
 */
export function yeniOrtalama(eskiMiktar: number, eskiOrt: number | null, girisMiktar: number, birimMaliyet: number): number {
  if (eskiMiktar <= 0 || eskiOrt === null) return birimMaliyet;
  const toplam = eskiMiktar + girisMiktar;
  return toplam > 0 ? (eskiMiktar * eskiOrt + girisMiktar * birimMaliyet) / toplam : birimMaliyet;
}

export type KritikDurum = "eksi" | "yok" | "kritik" | "normal";
export function kritikDurum(miktar: number, kritik: number | null): KritikDurum {
  if (miktar < 0) return "eksi";
  if (miktar === 0) return "yok";
  if (kritik !== null && miktar <= kritik) return "kritik";
  return "normal";
}

/**
 * Satışta istenen miktarları ürün bazında toplar ve stoğu yetmeyenleri döndürür.
 * Hizmet kartları stok tutmaz, kontrol edilmez.
 */
export function stokYetersiz(
  istek: { urunId: number; miktar: number }[],
  urunler: { id: number; ad: string; miktar: number; birim: string; hizmet: boolean }[],
): { ad: string; istenen: number; mevcut: number; birim: string }[] {
  const toplam = new Map<number, number>();
  for (const x of istek) toplam.set(x.urunId, (toplam.get(x.urunId) ?? 0) + x.miktar);
  return [...toplam.entries()]
    .map(([id, istenen]) => ({ u: urunler.find((x) => x.id === id), istenen }))
    .filter((x): x is { u: (typeof urunler)[number]; istenen: number } => !!x.u && !x.u.hizmet && miktarYuvarla(x.u.miktar - x.istenen) < 0)
    .map(({ u, istenen }) => ({ ad: u.ad, istenen, mevcut: u.miktar, birim: u.birim }));
}

/** Sayım farkı: sayılan − sistemdeki. Sayıma girmeyen ürün değişmez. */
export function sayimFarki(sayilan: number, sistem: number) {
  return miktarYuvarla(sayilan - sistem);
}

/** Ürün kodu önerisi: grup baş harfleri + sıra ("YP-00012") */
export function kodOner(onEk: string, sonNo: number) {
  return `${onEk}-${String(sonNo + 1).padStart(5, "0")}`;
}

const kurus = (n: number) => Math.round(n * 100) / 100;

/**
 * Kâr oranıyla satış fiyatı (vergiler dahil): baz maliyet (KDV hariç son alış) × (1 + kâr oranı),
 * üzerine ÖTV, sonra KDV. Kâr oranı maliyet üzerinedir: %30 → maliyet × 1,30.
 */
export function marjliFiyat(baz: number, karOrani: number, kdvOrani: number, otvOrani = 0) {
  return kurus(baz * (1 + karOrani) * (1 + otvOrani) * (1 + kdvOrani));
}

/** Vergiler dahil satış fiyatının maliyet üzerine kâr oranı; maliyet yoksa null */
export function fiyattanKarOrani(fiyat: number, baz: number | null, kdvOrani: number, otvOrani = 0) {
  if (!baz || baz <= 0) return null;
  return fiyat / ((1 + otvOrani) * (1 + kdvOrani)) / baz - 1;
}
