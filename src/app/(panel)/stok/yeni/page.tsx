import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { urunTanimlari } from "@/lib/stokTanim";
import { urunKaydet } from "../eylem";
import { UrunFormu } from "../UrunFormu";

export const metadata = { title: "Yeni ürün" };

export default async function YeniUrun({ searchParams }: { searchParams: Promise<{ ad?: string; barkod?: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const p = await searchParams;
  const tanim = await urunTanimlari(db);
  return (
    <>
      <SayfaBaslik baslik="Yeni ürün kartı" />
      <UrunFormu eylem={urunKaydet.bind(null, null)} yeni {...tanim} yonetici={k.rol === "YONETICI"} v={{ ad: p.ad, barkod: p.barkod }} maliyetGoster={maliyetGorur(k)} />
    </>
  );
}
