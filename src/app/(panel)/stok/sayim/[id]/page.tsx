import Link from "next/link";
import { notFound } from "next/navigation";
import { Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { miktar, tarihSaat, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { sayimFarki } from "@/lib/stokHesap";
import { sayimKapat, sayimSatirSil, sayimSatirYaz } from "../eylem";
import { SayimGirisFormu } from "../SayimFormlari";
import { SayimKapatButonu } from "./SayimKapatButonu";

export default async function SayimDetay({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const id = Number((await params).id);
  const s = Number.isInteger(id)
    ? await db.sayim.findUnique({ where: { id }, include: { satirlar: { orderBy: { guncelleme: "desc" }, include: { urun: true } } } })
    : null;
  if (!s) notFound();
  const acik = s.durum === "ACIK";
  const maliyet = maliyetGorur(k);
  const satirlar = s.satirlar.map((x) => {
    const sistem = acik ? Number(x.urun.miktar) : Number(x.sistem ?? 0);
    const fark = sayimFarki(Number(x.sayilan), sistem);
    return { ...x, sistemM: sistem, fark, deger: fark * Number(x.urun.ortMaliyet ?? 0) };
  });
  const farkli = satirlar.filter((x) => x.fark !== 0);
  const toplamDeger = farkli.reduce((t, x) => t + x.deger, 0);

  return (
    <>
      <SayfaBaslik
        baslik={`Sayım ${s.sayimNo} · ${s.aciklama}`}
        aciklama={<>{acik ? <Etiket renk="sari">Açık</Etiket> : <Etiket renk="gri">Kapandı {tarihSaat(s.kapanis)}</Etiket>} · {s.kaydeden}, {tarihSaat(s.baslangic)}</>}
        sag={<Link href="/stok/sayim" className="text-sm text-zinc-600 hover:underline">Tüm sayımlar</Link>}
      />
      {acik && (
        <Kart baslik="Sayım girişi" className="mb-4">
          <SayimGirisFormu eylem={sayimSatirYaz.bind(null, s.id)} />
        </Kart>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-zinc-600">
          {satirlar.length} ürün sayıldı · {farkli.length} üründe fark var
          {maliyet && farkli.length > 0 && <> · fark değeri <b className={toplamDeger < 0 ? "text-red-700" : ""}>{tl(toplamDeger)}</b></>}
        </span>
        {acik && satirlar.length > 0 && <SayimKapatButonu eylem={sayimKapat.bind(null, s.id)} farkli={farkli.length} />}
      </div>
      <Tablo basliklar={["Kod", "Ürün", "Raf", acik ? "Sistemde (şu an)" : "Sistemdeydi", "Sayılan", "Fark", ...(maliyet ? ["Fark değeri"] : []), ...(acik ? [""] : [])]} bos={!satirlar.length}>
        {satirlar.map((x) => (
          <tr key={x.id} className={x.fark !== 0 ? "bg-amber-50/40" : ""}>
            <Hucre><Link href={`/stok/${x.urunId}`} className="font-mono hover:underline">{x.urun.kod}</Link></Hucre>
            <Hucre className="max-w-72 truncate">{x.urun.ad}</Hucre>
            <Hucre>{x.urun.raf ?? "-"}</Hucre>
            <Hucre className="text-right tabular-nums">{miktar(x.sistemM)}</Hucre>
            <Hucre className="text-right font-medium tabular-nums">{miktar(x.sayilan)} {x.urun.birim}</Hucre>
            <Hucre className={`text-right tabular-nums ${x.fark < 0 ? "text-red-700" : x.fark > 0 ? "text-green-700" : "text-zinc-400"}`}>{x.fark > 0 ? "+" : ""}{miktar(x.fark)}</Hucre>
            {maliyet && <Hucre className="text-right tabular-nums">{x.fark ? tl(x.deger) : "-"}</Hucre>}
            {acik && (
              <Hucre>
                <form action={sayimSatirSil.bind(null, s.id, x.id)}><button className="text-xs text-zinc-500 hover:text-red-700">Sil</button></form>
              </Hucre>
            )}
          </tr>
        ))}
      </Tablo>
    </>
  );
}
