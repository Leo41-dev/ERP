import Link from "next/link";
import type { Prisma, SatisDurum, SatisTur } from "@prisma/client";
import { BaglantiButon, Etiket, Girdi, Hucre, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { SATIS_DURUM_AD, SATIS_DURUM_RENK, tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";


export default async function Satislar({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; tur?: string }> }) {
  const k = await yetkiIste();
  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const where: Prisma.SatisWhereInput = {
    ...(k.rol === "SATIS" ? { saticiId: k.id } : {}),
    ...(p.durum ? { durum: p.durum as SatisDurum } : {}),
    ...(p.tur === "ARAC" || p.tur === "HIZLI" ? { tur: p.tur as SatisTur } : {}),
    ...(q
      ? {
          OR: [
            ...(/^\d+$/.test(q) ? [{ formNo: Number(q) }] : []),
            { cari: { unvan: { contains: q.toLocaleUpperCase("tr-TR") } } },
            { kalemler: { some: { arac: { sase: { contains: q.toUpperCase() } } } } },
            { faturaNo: { contains: q.toUpperCase() } },
            { kalemler: { some: { aciklama: { contains: q.toLocaleUpperCase("tr-TR") } } } },
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
      <SayfaBaslik baslik={k.rol === "SATIS" ? "Satışlarım" : "Satışlar"} sag={
          k.rol !== "DEPO" && (
            <div className="flex gap-2">
              <BaglantiButon href="/satislar/hizli" className="!bg-white !text-zinc-800 border border-zinc-300 hover:!bg-zinc-50">Hızlı satış</BaglantiButon>
              {k.rol !== "SERVIS" && <BaglantiButon href="/satislar/yeni">Araç satışı</BaglantiButon>}
            </div>
          )
        }
      />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <Girdi name="q" defaultValue={q} placeholder="Form no, müşteri, şase, ürün veya fatura no" className="md:col-span-2" />
        <Secim name="tur" defaultValue={p.tur ?? ""}>
          <option value="">Tüm satışlar</option>
          <option value="ARAC">Araç satışları</option>
          <option value="HIZLI">Hızlı satışlar</option>
        </Secim>
        <Secim name="durum" defaultValue={p.durum ?? ""}>
          <option value="">Tüm durumlar</option>
          {Object.entries(SATIS_DURUM_AD).map(([kod, ad]) => <option key={kod} value={kod}>{ad}</option>)}
        </Secim>
        <button className="hidden" />
      </form>
      <Tablo basliklar={["Form no", "Tarih", "Tür", "Müşteri", "Araç / kalemler", "Tutar", "Durum", "Satıcı"]} bos={!satislar.length}>
        {satislar.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/satislar/${s.id}`} className="font-medium hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarih(s.tarih)}</Hucre>
            <Hucre>{s.tur === "HIZLI" ? <Etiket renk="mavi">Hızlı</Etiket> : <Etiket>Araç</Etiket>}</Hucre>
            <Hucre>{s.cari.unvan}</Hucre>
            <Hucre className="max-w-72 truncate">{s.kalemler.map((x) => x.arac?.sase ?? x.aciklama).join(", ")}</Hucre>
            <Hucre>{tl(s.genelToplam)}</Hucre>
            <Hucre><Etiket renk={SATIS_DURUM_RENK[s.durum]}>{SATIS_DURUM_AD[s.durum]}</Etiket></Hucre>
            <Hucre>{s.satici?.adSoyad ?? "-"}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
