import Link from "next/link";
import type { Prisma, SatisDurum } from "@prisma/client";
import { BaglantiButon, Etiket, Girdi, Hucre, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { SATIS_DURUM_AD, SATIS_DURUM_RENK, tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";


export default async function Satislar({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string }> }) {
  const k = await yetkiIste();
  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const where: Prisma.SatisWhereInput = {
    ...(k.rol === "SATIS" ? { saticiId: k.id } : {}),
    ...(p.durum ? { durum: p.durum as SatisDurum } : {}),
    ...(q
      ? {
          OR: [
            ...(/^\d+$/.test(q) ? [{ formNo: Number(q) }] : []),
            { cari: { unvan: { contains: q.toLocaleUpperCase("tr-TR") } } },
            { kalemler: { some: { arac: { sase: { contains: q.toUpperCase() } } } } },
            { faturaNo: { contains: q.toUpperCase() } },
          ],
        }
      : {}),
  };
  const satislar = await db.satis.findMany({
    where,
    orderBy: { formNo: "desc" },
    take: 100,
    include: { cari: true, satici: true, kalemler: { include: { arac: true } } },
  });
  return (
    <>
      <SayfaBaslik baslik={k.rol === "SATIS" ? "Satışlarım" : "Satışlar"} sag={k.rol !== "DEPO" && <BaglantiButon href="/satislar/yeni">Yeni satış</BaglantiButon>} />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <Girdi name="q" defaultValue={q} placeholder="Form no, müşteri, şase veya fatura no" className="md:col-span-3" />
        <Secim name="durum" defaultValue={p.durum ?? ""}>
          <option value="">Tüm durumlar</option>
          {Object.entries(SATIS_DURUM_AD).map(([kod, ad]) => <option key={kod} value={kod}>{ad}</option>)}
        </Secim>
        <button className="hidden" />
      </form>
      <Tablo basliklar={["Form no", "Tarih", "Müşteri", "Araç", "Tutar", "Durum", "Satıcı"]} bos={!satislar.length}>
        {satislar.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/satislar/${s.id}`} className="font-medium hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarih(s.tarih)}</Hucre>
            <Hucre>{s.cari.unvan}</Hucre>
            <Hucre>{s.kalemler.map((x) => x.arac?.sase ?? x.aciklama).join(", ")}</Hucre>
            <Hucre>{tl(s.genelToplam)}</Hucre>
            <Hucre><Etiket renk={SATIS_DURUM_RENK[s.durum]}>{SATIS_DURUM_AD[s.durum]}</Etiket></Hucre>
            <Hucre>{s.satici?.adSoyad ?? "-"}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
