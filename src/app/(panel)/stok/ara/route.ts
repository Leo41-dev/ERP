import { db } from "@/lib/db";
import { maliyetGorur, mevcutKullanici } from "@/lib/oturum";

export type UrunBulunan = {
  id: number; kod: string; ad: string; birim: string; tur: string; miktar: number; satisFiyati: number | null; kdvOrani: number; barkod: string | null; alisFiyati?: number | null;
};

/** Ürün arama: /stok/ara?q=yağ — barkod ya da kod tam eşleşirse ilk sırada döner */
export async function GET(istek: Request) {
  const k = await mevcutKullanici();
  if (!k) return Response.json([], { status: 401 });
  const ham = (new URL(istek.url).searchParams.get("q") ?? "").trim();
  if (!ham) return Response.json([]);
  const q = ham.toLocaleUpperCase("tr-TR");
  const kelimeler = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const urunler = await db.urun.findMany({
    where: {
      aktif: true,
      tur: { not: "ARAC" },
      OR: [{ barkod: ham }, { kod: q }, { AND: kelimeler.map((w) => ({ OR: [{ ad: { contains: w } }, { kod: { contains: w } }] })) }],
    },
    orderBy: { ad: "asc" },
    take: 30,
  });
  const maliyet = maliyetGorur(k);
  const sonuc: UrunBulunan[] = urunler
    .map((u) => ({
      id: u.id, kod: u.kod, ad: u.ad, birim: u.birim, tur: u.tur, miktar: Number(u.miktar), barkod: u.barkod,
      satisFiyati: u.satisFiyati === null ? null : Number(u.satisFiyati), kdvOrani: Number(u.kdvOrani),
      ...(maliyet || k.rol === "DEPO" ? { alisFiyati: u.ortMaliyet !== null ? Number(u.ortMaliyet) : u.alisFiyati === null ? null : Number(u.alisFiyati) } : {}),
    }))
    .sort((a, b) => Number(b.barkod === ham || b.kod === q) - Number(a.barkod === ham || a.kod === q))
    .slice(0, 15);
  return Response.json(sonuc);
}
