import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { miktar, tarih, tarihSaat, tl, yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export default async function GirisDetay({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kayit?: string }> }) {
  await yetkiIste("DEPO", "MUHASEBE");
  const id = Number((await params).id);
  const p = await searchParams;
  const g = Number.isInteger(id)
    ? await db.stokGiris.findUnique({ where: { id }, include: { tedarikci: true, kalemler: { orderBy: { sira: "asc" }, include: { urun: true } } } })
    : null;
  if (!g) notFound();
  return (
    <>
      <SayfaBaslik
        baslik={`Stok girişi ${g.girisNo}`}
        aciklama={`${tarih(g.tarih)} · ${g.kaynak === "XML" ? "e-fatura" : "elle"} · ${g.kaydeden}, ${tarihSaat(g.olusturma)}`}
        sag={<BaglantiButon href="/stok/giris/yeni">Yeni giriş</BaglantiButon>}
      />
      {p.kayit && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Giriş kaydedildi, stoklar güncellendi.</p>}
      <Kart className="mb-4">
        <dl className="grid gap-4 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-zinc-500">Tedarikçi</dt><dd>{g.tedarikci ? <Link href={`/musteriler/${g.tedarikci.id}`} className="hover:underline">{g.tedarikci.unvan}</Link> : "-"}</dd></div>
          <div><dt className="text-xs text-zinc-500">Fatura / irsaliye no</dt><dd>{g.faturaNo ?? "-"}</dd></div>
          <div><dt className="text-xs text-zinc-500">KDV hariç / KDV</dt><dd className="tabular-nums">{tl(g.araToplam)} · {tl(g.kdvToplam)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Toplam</dt><dd className="text-base font-semibold tabular-nums">{tl(g.genelToplam)}</dd></div>
        </dl>
        {g.not && <p className="mt-3 text-sm text-zinc-600">{g.not}</p>}
      </Kart>
      <Tablo basliklar={["#", "Kod", "Ürün", "Faturadaki ad", "Miktar", "Birim fiyat", "KDV", "Tutar (KDV hariç)"]}>
        {g.kalemler.map((x) => (
          <tr key={x.id}>
            <Hucre>{x.sira}</Hucre>
            <Hucre><Link href={`/stok/${x.urunId}`} className="font-mono hover:underline">{x.urun.kod}</Link></Hucre>
            <Hucre className="max-w-72 truncate">{x.urun.ad}</Hucre>
            <Hucre className="max-w-72 truncate text-zinc-500">{x.faturaAdi && x.faturaAdi !== x.urun.ad ? x.faturaAdi : ""}</Hucre>
            <Hucre className="text-right tabular-nums">{miktar(x.miktar)} {x.urun.birim}</Hucre>
            <Hucre className="text-right tabular-nums">{tl(x.birimFiyat)}</Hucre>
            <Hucre>{yuzde(x.kdvOrani)}</Hucre>
            <Hucre className="text-right tabular-nums">{tl(x.tutar)}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
