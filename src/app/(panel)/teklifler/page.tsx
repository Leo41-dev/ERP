import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BaglantiButon, Etiket, Girdi, Hucre, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { tarih, teklifDurum, telefonGoster, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { bugunTr } from "@/lib/dogrulama/teklif";
import { yetkiIste } from "@/lib/oturum";

export default async function Teklifler({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const bugun = new Date(`${bugunTr()}T00:00:00Z`);
  const durumFiltre: Prisma.TeklifWhereInput =
    p.durum === "ACIK" ? { durum: "ACIK", gecerlilik: { gte: bugun } }
    : p.durum === "DOLDU" ? { durum: "ACIK", gecerlilik: { lt: bugun } }
    : p.durum === "KABUL" || p.durum === "RET" ? { durum: p.durum }
    : {};
  const where: Prisma.TeklifWhereInput = {
    ...(k.rol === "SATIS" ? { saticiId: k.id } : {}),
    ...durumFiltre,
    ...(q
      ? {
          OR: [
            ...(/^\d+$/.test(q) && q.length < 7 ? [{ teklifNo: Number(q) }] : []),
            { musteriAd: { contains: q.toLocaleUpperCase("tr-TR") } },
            { telefon: { contains: q.replace(/\D/g, "").replace(/^0/, "") || q } },
            { kalemler: { some: { aciklama: { contains: q.toLocaleUpperCase("tr-TR") } } } },
          ],
        }
      : {}),
  };
  const [teklifler, ozet] = await Promise.all([
    db.teklif.findMany({ where, orderBy: { teklifNo: "desc" }, take: 100, include: { satici: true, kalemler: { orderBy: { sira: "asc" }, select: { aciklama: true } }, satis: { select: { id: true, formNo: true } } } }),
    db.teklif.groupBy({ by: ["durum"], where: { ...(k.rol === "SATIS" ? { saticiId: k.id } : {}), tarih: { gte: new Date(Date.now() - 90 * 86_400_000) } }, _count: true }),
  ]);
  const sayi = (d: string) => ozet.find((o) => o.durum === d)?._count ?? 0;
  const sonuclanan = sayi("KABUL") + sayi("RET");
  return (
    <>
      <SayfaBaslik
        baslik={k.rol === "SATIS" ? "Tekliflerim" : "Teklifler"}
        aciklama={`Son 90 gün: ${sayi("ACIK") + sonuclanan} teklif, ${sayi("KABUL")} satışa döndü${sonuclanan ? ` (sonuçlananların %${Math.round((sayi("KABUL") / sonuclanan) * 100)}'i)` : ""}`}
        sag={<BaglantiButon href="/teklifler/yeni">Yeni teklif</BaglantiButon>}
      />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <Girdi name="q" defaultValue={q} placeholder="Teklif no, müşteri, telefon ya da model" className="md:col-span-3" />
        <Secim name="durum" defaultValue={p.durum ?? ""}>
          <option value="">Tüm teklifler</option>
          <option value="ACIK">Açık</option>
          <option value="DOLDU">Süresi dolmuş</option>
          <option value="KABUL">Satışa dönmüş</option>
          <option value="RET">Reddedilmiş</option>
        </Secim>
        <button className="hidden" />
      </form>
      <Tablo basliklar={["No", "Tarih", "Müşteri", "Kalemler", "Tutar", "Geçerlilik", "Durum", "Satıcı"]} bos={!teklifler.length}>
        {teklifler.map((t) => {
          const d = teklifDurum(t);
          return (
            <tr key={t.id} className="hover:bg-zinc-50">
              <Hucre><Link href={`/teklifler/${t.id}`} className="font-medium hover:underline">{t.teklifNo}</Link></Hucre>
              <Hucre>{tarih(t.tarih)}</Hucre>
              <Hucre>{t.musteriAd}{t.telefon && <span className="block text-xs text-zinc-500">{telefonGoster(t.telefon)}</span>}</Hucre>
              <Hucre className="max-w-72 truncate">{t.kalemler.map((x) => x.aciklama).join(", ")}</Hucre>
              <Hucre>{tl(t.genelToplam)}</Hucre>
              <Hucre>{tarih(t.gecerlilik)}</Hucre>
              <Hucre>
                <Etiket renk={d.renk}>{d.ad}</Etiket>
                {t.satis && <Link href={`/satislar/${t.satis.id}`} className="ml-1 text-xs text-zinc-600 hover:underline">#{t.satis.formNo}</Link>}
              </Hucre>
              <Hucre>{t.satici?.adSoyad ?? "-"}</Hucre>
            </tr>
          );
        })}
      </Tablo>
    </>
  );
}
