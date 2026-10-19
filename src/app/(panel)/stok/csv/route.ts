import type { Prisma } from "@prisma/client";
import { csv } from "@/lib/analizHesap";
import { URUN_TUR_AD } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export async function GET(istek: Request) {
  await yetkiIste("MUHASEBE");
  const p = new URL(istek.url).searchParams;
  const q = (p.get("q") ?? "").trim().toLocaleUpperCase("tr-TR");
  const where: Prisma.UrunWhereInput = {
    tur: p.get("tur") ? (p.get("tur") as Prisma.UrunWhereInput["tur"]) : { not: "ARAC" },
    aktif: true,
    ...(p.get("grup") ? { grup: p.get("grup") } : {}),
    ...(q ? { OR: [{ kod: { contains: q } }, { ad: { contains: q } }, { barkod: q }, { raf: { contains: q } }] } : {}),
  };
  const urunler = await db.urun.findMany({ where, orderBy: [{ grup: "asc" }, { ad: "asc" }] });
  const metin = csv({
    anahtar: "stok", baslik: "Stok", aciklama: "",
    kolonlar: [
      { ad: "Kod", tur: "metin" }, { ad: "Ürün", tur: "metin" }, { ad: "Tür", tur: "metin" }, { ad: "Grup", tur: "metin" }, { ad: "Barkod", tur: "metin" }, { ad: "Raf", tur: "metin" },
      { ad: "Miktar", tur: "adet" }, { ad: "Birim", tur: "metin" }, { ad: "Kritik seviye", tur: "adet" }, { ad: "Satış fiyatı (KDV dahil)", tur: "tl" }, { ad: "Ort. maliyet (KDV hariç)", tur: "tl" }, { ad: "Stok değeri", tur: "tl" },
    ],
    satirlar: urunler.map((u) => {
      const m = Number(u.miktar), o = u.ortMaliyet === null ? null : Number(u.ortMaliyet);
      return [u.kod, u.ad, URUN_TUR_AD[u.tur], u.grup ?? "", u.barkod ?? "", u.raf ?? "", m, u.birim, u.kritikStok === null ? null : Number(u.kritikStok), u.satisFiyati === null ? null : Number(u.satisFiyati), o, m > 0 && o !== null ? m * o : null];
    }),
  });
  const gun = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  return new Response(metin, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="stok-${gun}.csv"` } });
}
