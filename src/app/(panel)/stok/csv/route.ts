import { csv } from "@/lib/analizHesap";
import { URUN_TUR_AD } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { urunFiltresi } from "@/lib/stokTanim";

export async function GET(istek: Request) {
  await yetkiIste("MUHASEBE");
  const p = new URL(istek.url).searchParams;
  const where = { ...urunFiltresi({ q: p.get("q"), tur: p.get("tur"), grup: p.get("grup"), marka: p.get("marka") }), aktif: true };
  const urunler = await db.urun.findMany({ where, include: { grup: true, marka: true }, orderBy: [{ grup: { ad: "asc" } }, { ad: "asc" }] });
  const metin = csv({
    anahtar: "stok", baslik: "Stok", aciklama: "",
    kolonlar: [
      { ad: "Kod", tur: "metin" }, { ad: "Ürün", tur: "metin" }, { ad: "Tür", tur: "metin" }, { ad: "Grup", tur: "metin" }, { ad: "Marka", tur: "metin" }, { ad: "Barkod", tur: "metin" }, { ad: "Raf", tur: "metin" },
      { ad: "Miktar", tur: "adet" }, { ad: "Birim", tur: "metin" }, { ad: "Kritik seviye", tur: "adet" }, { ad: "Satış fiyatı (KDV dahil)", tur: "tl" }, { ad: "Ort. maliyet (KDV hariç)", tur: "tl" }, { ad: "Stok değeri", tur: "tl" },
    ],
    satirlar: urunler.map((u) => {
      const m = Number(u.miktar), o = u.ortMaliyet === null ? null : Number(u.ortMaliyet);
      return [u.kod, u.ad, URUN_TUR_AD[u.tur], u.grup?.ad ?? "", u.marka?.ad ?? "", u.barkod ?? "", u.raf ?? "", m, u.birim, u.kritikStok === null ? null : Number(u.kritikStok), u.satisFiyati === null ? null : Number(u.satisFiyati), o, m > 0 && o !== null ? m * o : null];
    }),
  });
  const gun = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  return new Response(metin, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="stok-${gun}.csv"` } });
}
