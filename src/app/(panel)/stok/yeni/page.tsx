import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { urunKaydet } from "../eylem";
import { UrunFormu } from "../UrunFormu";

export const metadata = { title: "Yeni ürün" };

export default async function YeniUrun({ searchParams }: { searchParams: Promise<{ ad?: string; barkod?: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const p = await searchParams;
  const gruplar = await db.urun.findMany({ where: { grup: { not: null } }, distinct: ["grup"], select: { grup: true }, orderBy: { grup: "asc" } });
  return (
    <>
      <SayfaBaslik baslik="Yeni ürün kartı" />
      <UrunFormu eylem={urunKaydet.bind(null, null)} yeni gruplar={gruplar.map((g) => g.grup!)} v={{ ad: p.ad, barkod: p.barkod }} maliyetGoster={maliyetGorur(k)} />
    </>
  );
}
