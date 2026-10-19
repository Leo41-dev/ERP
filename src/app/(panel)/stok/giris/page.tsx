import Link from "next/link";
import { BaglantiButon, Hucre, SayfaBaslik, Tablo } from "@/components/ui";
import { tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";

export const metadata = { title: "Stok girişleri" };

export default async function Girisler() {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const maliyet = maliyetGorur(k) || k.rol === "DEPO";
  const girisler = await db.stokGiris.findMany({ orderBy: { id: "desc" }, take: 200, include: { tedarikci: { select: { unvan: true } }, _count: { select: { kalemler: true } } } });
  return (
    <>
      <SayfaBaslik baslik="Stok girişleri" aciklama="Tedarikçiden gelen parça ve aksesuar girişleri." sag={<BaglantiButon href="/stok/giris/yeni">Yeni giriş</BaglantiButon>} />
      <Tablo basliklar={["No", "Tarih", "Tedarikçi", "Fatura no", "Kalem", "Kaynak", ...(maliyet ? ["Tutar (KDV dahil)"] : []), "Kaydeden"]} bos={!girisler.length}>
        {girisler.map((g) => (
          <tr key={g.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/stok/giris/${g.id}`} className="font-medium hover:underline">{g.girisNo}</Link></Hucre>
            <Hucre>{tarih(g.tarih)}</Hucre>
            <Hucre>{g.tedarikci?.unvan ?? "-"}</Hucre>
            <Hucre>{g.faturaNo ?? "-"}</Hucre>
            <Hucre>{g._count.kalemler}</Hucre>
            <Hucre>{g.kaynak === "XML" ? "E-fatura" : "Elle"}</Hucre>
            {maliyet && <Hucre className="text-right tabular-nums">{tl(g.genelToplam)}</Hucre>}
            <Hucre className="text-zinc-500">{g.kaydeden}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
