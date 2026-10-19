import Link from "next/link";
import { Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { tarihSaat } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { sayimBaslat } from "./eylem";
import { SayimBaslatFormu } from "./SayimFormlari";

export const metadata = { title: "Sayım" };

export default async function Sayimlar() {
  await yetkiIste("DEPO", "MUHASEBE");
  const sayimlar = await db.sayim.findMany({ orderBy: { id: "desc" }, take: 100, include: { _count: { select: { satirlar: true, hareketler: true } } } });
  return (
    <>
      <SayfaBaslik baslik="Sayım" aciklama="Rafları sayıp sonucu girin; sayım kapatılınca farklar stoğa işlenir. Sayıma girmeyen ürünlerin miktarı değişmez, bölüm bölüm sayılabilir." />
      <Kart baslik="Yeni sayım" className="mb-6"><SayimBaslatFormu eylem={sayimBaslat} /></Kart>
      <Tablo basliklar={["No", "Sayım", "Durum", "Sayılan ürün", "Fark çıkan", "Başlangıç", "Kapanış", "Başlatan"]} bos={!sayimlar.length}>
        {sayimlar.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/stok/sayim/${s.id}`} className="font-medium hover:underline">{s.sayimNo}</Link></Hucre>
            <Hucre><Link href={`/stok/sayim/${s.id}`} className="hover:underline">{s.aciklama}</Link></Hucre>
            <Hucre>{s.durum === "ACIK" ? <Etiket renk="sari">Açık</Etiket> : <Etiket renk="gri">Kapandı</Etiket>}</Hucre>
            <Hucre>{s._count.satirlar}</Hucre>
            <Hucre>{s.durum === "KAPALI" ? s._count.hareketler : "-"}</Hucre>
            <Hucre>{tarihSaat(s.baslangic)}</Hucre>
            <Hucre>{tarihSaat(s.kapanis)}</Hucre>
            <Hucre className="text-zinc-500">{s.kaydeden}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
