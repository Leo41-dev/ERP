import Link from "next/link";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { ODEME_AD, tarih, tarihSaat, telefonGoster, tl } from "@/lib/bicim";
import { acikSatislar, borcluCariler } from "@/lib/cari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { SenetTahsilButonu, TahsilatIptalButonu } from "./Islemler";

export default async function Tahsilat({ searchParams }: { searchParams: Promise<{ makbuz?: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const makbuz = (await searchParams).makbuz;
  const muhasebe = k.rol === "YONETICI" || k.rol === "MUHASEBE";
  const kendi = k.rol === "SATIS" ? { saticiId: k.id } : {};
  const bugun = new Date(new Date().toISOString().slice(0, 10));
  const [portfoy, acik, borclu, son] = await Promise.all([
    db.tahsilat.findMany({
      where: { yontem: { in: ["SENET", "CEK"] }, tahsilTarihi: null, iptalZamani: null },
      orderBy: { vade: "asc" },
      include: { cari: { select: { id: true, unvan: true, telefon: true } }, satis: { select: { id: true, formNo: true } } },
    }),
    acikSatislar(kendi),
    muhasebe ? borcluCariler() : Promise.resolve([]),
    db.tahsilat.findMany({
      where: k.rol === "SATIS" ? { kaydeden: k.adSoyad } : {},
      orderBy: { id: "desc" },
      take: 30,
      include: { cari: { select: { id: true, unvan: true } }, satis: { select: { id: true, formNo: true } } },
    }),
  ]);
  const vadesiGecen = portfoy.filter((t) => t.vade && t.vade < bugun);

  return (
    <>
      <SayfaBaslik baslik="Tahsilat" aciklama="Açık satışlar, senet/çek portföyü ve son tahsilatlar" sag={<BaglantiButon href="/tahsilat/yeni">Tahsilat al</BaglantiButon>} />

      {makbuz && (
        <Kart className="mb-4 border-green-300 bg-green-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-green-800">Tahsilat kaydedildi.</p>
            <BaglantiButon href={`/yazdir/makbuz?id=${makbuz}`} target="_blank">Makbuzu yazdır</BaglantiButon>
          </div>
        </Kart>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kart><p className="text-xs text-zinc-500">Ödemesi kalan satış</p><p className="mt-1 text-xl font-semibold">{acik.length}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Kalan tutar</p><p className="mt-1 text-xl font-semibold">{tl(acik.reduce((t, s) => t + s.kalan, 0))}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Portföydeki senet/çek</p><p className="mt-1 text-xl font-semibold">{tl(portfoy.reduce((t, s) => t + Number(s.tutar), 0))}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Vadesi geçen</p><p className={`mt-1 text-xl font-semibold ${vadesiGecen.length ? "text-red-600" : ""}`}>{vadesiGecen.length} · {tl(vadesiGecen.reduce((t, s) => t + Number(s.tutar), 0))}</p></Kart>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Senet ve çek portföyü</h2>
      <Tablo basliklar={["Vade", "Tür", "Müşteri", "Telefon", "Tutar", "Satış", "Açıklama", ""]} bos={!portfoy.length}>
        {portfoy.map((t) => (
          <tr key={t.id} className={t.vade && t.vade < bugun ? "bg-red-50" : ""}>
            <Hucre>{tarih(t.vade)}{t.vade && t.vade < bugun && <Etiket renk="kirmizi">Geçti</Etiket>}</Hucre>
            <Hucre>{ODEME_AD[t.yontem]}</Hucre>
            <Hucre><Link href={`/musteriler/${t.cari.id}`} className="hover:underline">{t.cari.unvan}</Link></Hucre>
            <Hucre>{telefonGoster(t.cari.telefon)}</Hucre>
            <Hucre>{tl(t.tutar)}</Hucre>
            <Hucre>{t.satis ? <Link href={`/satislar/${t.satis.id}`} className="hover:underline">{t.satis.formNo}</Link> : "-"}</Hucre>
            <Hucre className="max-w-48 truncate">{t.aciklama ?? "-"}</Hucre>
            <Hucre>{muhasebe && <SenetTahsilButonu id={t.id} />}</Hucre>
          </tr>
        ))}
      </Tablo>

      <h2 className="mb-2 mt-8 text-sm font-semibold">Ödemesi kalan satışlar</h2>
      <Tablo basliklar={["Satış", "Tarih", "Müşteri", "Tutar", "Tahsil edilen", "Kalan", ""]} bos={!acik.length}>
        {acik.map((s) => (
          <tr key={s.id}>
            <Hucre><Link href={`/satislar/${s.id}`} className="font-medium hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarih(s.tarih)}</Hucre>
            <Hucre><Link href={`/musteriler/${s.cariId}`} className="hover:underline">{s.unvan}</Link></Hucre>
            <Hucre>{tl(s.genelToplam)}</Hucre>
            <Hucre>{tl(s.tahsil)}</Hucre>
            <Hucre className="font-medium">{tl(s.kalan)}</Hucre>
            <Hucre><Link href={`/tahsilat/yeni?satis=${s.id}`} className="text-xs text-zinc-600 hover:underline">Tahsilat al</Link></Hucre>
          </tr>
        ))}
      </Tablo>

      {muhasebe && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold">Borçlu müşteriler (cari bakiye)</h2>
          <Tablo basliklar={["Müşteri", "Telefon", "Bakiye", "Son hareket"]} bos={!borclu.length}>
            {borclu.map((c) => (
              <tr key={c.id}>
                <Hucre><Link href={`/musteriler/${c.id}`} className="hover:underline">{c.unvan}</Link></Hucre>
                <Hucre>{telefonGoster(c.telefon)}</Hucre>
                <Hucre className="font-medium">{tl(c.bakiye)}</Hucre>
                <Hucre>{tarih(c.son)}</Hucre>
              </tr>
            ))}
          </Tablo>
        </>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold">Son tahsilatlar</h2>
      <Tablo basliklar={["Zaman", "Müşteri", "Yöntem", "Tutar", "Satış", "Kaydeden", ""]} bos={!son.length}>
        {son.map((t) => (
          <tr key={t.id} className={t.iptalZamani ? "text-zinc-400 line-through" : ""}>
            <Hucre>{tarihSaat(t.tarih)}</Hucre>
            <Hucre><Link href={`/musteriler/${t.cari.id}`} className="hover:underline">{t.cari.unvan}</Link></Hucre>
            <Hucre>{ODEME_AD[t.yontem]}{t.taksit ? ` · ${t.taksit} taksit` : ""}</Hucre>
            <Hucre>{tl(t.tutar)}</Hucre>
            <Hucre>{t.satis ? <Link href={`/satislar/${t.satis.id}`} className="hover:underline">{t.satis.formNo}</Link> : "-"}</Hucre>
            <Hucre>{t.kaydeden ?? "-"}</Hucre>
            <Hucre>
              {!t.iptalZamani && (
                <span className="flex gap-3">
                  <Link href={`/yazdir/makbuz?id=${t.id}`} target="_blank" className="text-xs text-zinc-600 hover:underline">Makbuz</Link>
                  {muhasebe && <TahsilatIptalButonu id={t.id} />}
                </span>
              )}
              {t.iptalZamani && <span className="text-xs no-underline">İptal: {t.iptalNedeni}</span>}
            </Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
