import Link from "next/link";
import { Girdi, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { telefonGoster, tl } from "@/lib/bicim";
import { acikSatislar, cariBakiye } from "@/lib/cari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { TahsilatFormu } from "./TahsilatFormu";

export default async function YeniTahsilat({ searchParams }: { searchParams: Promise<{ cari?: string; satis?: string; q?: string }> }) {
  await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const p = await searchParams;
  let cariId = Number(p.cari) || null;
  const satisId = Number(p.satis) || null;
  if (!cariId && satisId) cariId = (await db.satis.findUnique({ where: { id: satisId }, select: { cariId: true } }))?.cariId ?? null;
  const cari = cariId ? await db.cari.findUnique({ where: { id: cariId } }) : null;

  if (!cari) {
    // önce müşteri bulunur
    const q = (p.q ?? "").trim();
    const rakam = q.replace(/\D/g, "");
    const sonuc = q
      ? await db.cari.findMany({
          where: { OR: [{ unvan: { contains: q.toLocaleUpperCase("tr-TR") } }, ...(rakam.length >= 4 ? [{ telefon: { contains: rakam.replace(/^0/, "") } }, { tckn: rakam }, { vkn: rakam }] : [])] },
          take: 20,
          orderBy: { unvan: "asc" },
        })
      : [];
    return (
      <>
        <SayfaBaslik baslik="Tahsilat al" aciklama="Önce müşteriyi bulun." />
        <form className="mb-4"><Girdi name="q" defaultValue={q} placeholder="Ad, telefon, TCKN veya VKN" autoFocus /></form>
        {q && (
          <Tablo basliklar={["Müşteri", "Telefon", "Kimlik"]} bos={!sonuc.length}>
            {sonuc.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50">
                <Hucre><Link href={`/tahsilat/yeni?cari=${c.id}`} className="font-medium hover:underline">{c.unvan}</Link></Hucre>
                <Hucre>{telefonGoster(c.telefon)}</Hucre>
                <Hucre>{c.tckn ?? c.vkn ?? "-"}</Hucre>
              </tr>
            ))}
          </Tablo>
        )}
      </>
    );
  }

  const [acik, bakiye] = await Promise.all([acikSatislar({ cariId: cari.id }), cariBakiye(cari.id)]);
  const kalemler = await db.satisKalemi.findMany({ where: { satisId: { in: acik.map((s) => s.id) } }, select: { satisId: true, aciklama: true } });
  return (
    <>
      <SayfaBaslik baslik="Tahsilat al" aciklama={<><Link href={`/musteriler/${cari.id}`} className="hover:underline">{cari.unvan}</Link> · bakiye {tl(bakiye.bakiye)}</>} />
      {!acik.length && <Kart className="mb-4"><p className="text-sm text-zinc-600">Bu müşterinin ödemesi kalan satışı yok. Kapora ya da genel tahsilat girebilirsiniz.</p></Kart>}
      <TahsilatFormu
        cariId={cari.id}
        secili={satisId}
        bugun={new Date().toISOString().slice(0, 10)}
        satislar={acik.map((s) => ({ id: s.id, formNo: s.formNo, kalan: s.kalan, aciklama: kalemler.filter((k) => k.satisId === s.id).map((k) => k.aciklama).join(", ").slice(0, 60) }))}
      />
    </>
  );
}
