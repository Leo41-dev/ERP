import type { Prisma } from "@prisma/client";
import { kdvOranlari, otvOranlariYazi } from "./vergi";
import type { VergiHesapTuru } from "./vergiHesap";

type Db = Pick<Prisma.TransactionClient, "urunGrubu" | "urunMarkasi" | "kdvOrani" | "otvOrani" | "vergiTanimi">;
export type VergiSecenek = { id: number; ad: string; hesap: VergiHesapTuru; deger: number; kdvMatrahina: boolean; kesinti: boolean; aktif: boolean };
export type Tanim = { id: number; ad: string; aktif: boolean };

/** Ürün formu seçenekleri: aktif grup ve markalar (artı üründe seçili olan pasif kayıt), KDV ve ÖTV oranları */
export async function urunTanimlari(db: Db, secili: { grupId?: number | null; markaId?: number | null; vergiIdler?: number[] } = {}) {
  const kosul = (id?: number | null) => ({ OR: [{ aktif: true }, ...(id ? [{ id }] : [])] });
  const [gruplar, markalar, kdv, otv, vergiler] = await Promise.all([
    db.urunGrubu.findMany({ where: kosul(secili.grupId), orderBy: { ad: "asc" }, select: { id: true, ad: true, aktif: true } }),
    db.urunMarkasi.findMany({ where: kosul(secili.markaId), orderBy: { ad: "asc" }, select: { id: true, ad: true, aktif: true } }),
    kdvOranlari(db),
    otvOranlariYazi(db),
    db.vergiTanimi.findMany({ where: { OR: [{ aktif: true }, { id: { in: secili.vergiIdler ?? [] } }] }, orderBy: { ad: "asc" } }),
  ]);
  const vergiTanimlari: VergiSecenek[] = vergiler.map((v) => ({ id: v.id, ad: v.ad, hesap: v.hesap, deger: Number(v.deger), kdvMatrahina: v.kdvMatrahina, kesinti: v.kesinti, aktif: v.aktif }));
  return { gruplar, markalar, kdvOranlari: kdv, otvOranlari: otv, vergiTanimlari };
}

/** Arama metninin büyük harf biçimleri: "maxxis" hem MAXXİS hem MAXXIS olarak aranır (yabancı marka adları) */
export const buyukHarfler = (w: string) => [...new Set([w.toLocaleUpperCase("tr-TR"), w.toUpperCase()])];

/** Stok listesi ve CSV'de ortak filtre */
export function urunFiltresi(p: { q?: string | null; tur?: string | null; grup?: string | null; marka?: string | null }): Prisma.UrunWhereInput {
  const q = (p.q ?? "").trim();
  return {
    tur: p.tur ? (p.tur as Prisma.UrunWhereInput["tur"]) : { not: "ARAC" },
    ...(p.grup ? { grupId: Number(p.grup) || -1 } : {}),
    ...(p.marka ? { markaId: Number(p.marka) || -1 } : {}),
    ...(q ? { OR: [{ barkod: q }, ...buyukHarfler(q).flatMap((w) => [{ kod: { contains: w } }, { ad: { contains: w } }, { raf: { contains: w } }, { marka: { ad: { contains: w } } }])] } : {}),
  };
}
