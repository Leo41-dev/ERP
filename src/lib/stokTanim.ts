import type { Prisma } from "@prisma/client";

type Db = Pick<Prisma.TransactionClient, "urunGrubu" | "urunMarkasi">;
export type Tanim = { id: number; ad: string; aktif: boolean };

/** Ürün formu için grup ve marka seçenekleri: aktif olanlar, artı üründe seçili olan pasif kayıt */
export async function urunTanimlari(db: Db, secili: { grupId?: number | null; markaId?: number | null } = {}) {
  const kosul = (id?: number | null) => ({ OR: [{ aktif: true }, ...(id ? [{ id }] : [])] });
  const [gruplar, markalar] = await Promise.all([
    db.urunGrubu.findMany({ where: kosul(secili.grupId), orderBy: { ad: "asc" }, select: { id: true, ad: true, aktif: true } }),
    db.urunMarkasi.findMany({ where: kosul(secili.markaId), orderBy: { ad: "asc" }, select: { id: true, ad: true, aktif: true } }),
  ]);
  return { gruplar, markalar };
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
