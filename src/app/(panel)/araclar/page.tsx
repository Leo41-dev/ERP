import Link from "next/link";
import type { AracDurum, Prisma } from "@prisma/client";
import { BaglantiButon, Etiket, Girdi, Hucre, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { ARAC_DURUM_AD, KONDISYON_AD, tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";

const DURUM_RENK = { STOKTA: "yesil", REZERVE: "sari", SATILDI: "gri", IADE: "kirmizi" } as const;

export default async function Araclar({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; konum?: string }> }) {
  const k = await yetkiIste();
  const p = await searchParams;
  const q = (p.q ?? "").trim().toUpperCase();
  const durum = (p.durum ?? "STOKTA") as AracDurum | "TUMU";
  const where: Prisma.AracWhereInput = {
    ...(durum !== "TUMU" ? { durum } : {}),
    ...(p.konum ? { konumId: Number(p.konum) } : {}),
    ...(q
      ? { OR: [{ sase: { contains: q } }, { plaka: { contains: q } }, { model: { OR: [{ model: { contains: q } }, { altModel: { contains: q } }, { marka: { ad: { contains: q } } }] } }] }
      : {}),
  };
  const maliyet = maliyetGorur(k);
  const [araclar, konumlar] = await Promise.all([
    db.arac.findMany({
      where,
      orderBy: { gelisTarihi: "asc" },
      take: 200,
      include: { model: { include: { marka: true } }, konum: true, maliyetler: maliyet },
    }),
    db.konum.findMany({ orderBy: { ad: "asc" } }),
  ]);
  const bugun = Date.now();
  return (
    <>
      <SayfaBaslik baslik="Araçlar" aciklama={`${araclar.length} araç${araclar.length === 200 ? " (ilk 200)" : ""}`} sag={
          k.rol !== "SATIS" && (
            <div className="flex gap-2">
              {k.rol !== "SERVIS" && <BaglantiButon href="/araclar/fatura" className="!bg-white !text-zinc-800 border border-zinc-300 hover:!bg-zinc-50">Fatura ile giriş</BaglantiButon>}
              <BaglantiButon href="/araclar/yeni">Araç girişi</BaglantiButon>
            </div>
          )
        }
      />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <Girdi name="q" defaultValue={p.q} placeholder="Şase, plaka, marka veya model" className="md:col-span-2" />
        <Secim name="durum" defaultValue={durum}>
          <option value="TUMU">Tüm durumlar</option>
          {Object.entries(ARAC_DURUM_AD).map(([kod, ad]) => <option key={kod} value={kod}>{ad}</option>)}
        </Secim>
        <Secim name="konum" defaultValue={p.konum ?? ""}>
          <option value="">Tüm konumlar</option>
          {konumlar.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
        </Secim>
        <button className="hidden" />
      </form>
      <form id="etiket" action="/yazdir/etiket" target="_blank" className="mb-2 flex justify-end">
        <button className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline">Seçilenlerin QR etiketini yazdır</button>
      </form>
      <Tablo
        basliklar={["", "Şase", "Marka / model", "Yıl", "Renk", "Kondisyon", "Konum", "Durum", "Geliş", "Bekleme", ...(maliyet ? ["Maliyet"] : [])]}
        bos={!araclar.length}
      >
        {araclar.map((a) => (
          <tr key={a.id} className="hover:bg-zinc-50">
            <Hucre><input type="checkbox" name="id" value={a.id} form="etiket" aria-label={`${a.sase} etiketi`} /></Hucre>
            <Hucre><Link href={`/araclar/${a.id}`} className="font-mono font-medium hover:underline">{a.sase}</Link></Hucre>
            <Hucre>{a.model ? `${a.model.marka.ad} ${a.model.altModel || a.model.model}` : "-"}</Hucre>
            <Hucre>{a.yil ?? "-"}</Hucre>
            <Hucre>{a.renk ?? "-"}</Hucre>
            <Hucre>{KONDISYON_AD[a.kondisyon]}</Hucre>
            <Hucre>{a.konum?.ad ?? "-"}</Hucre>
            <Hucre><Etiket renk={DURUM_RENK[a.durum]}>{ARAC_DURUM_AD[a.durum]}</Etiket></Hucre>
            <Hucre>{tarih(a.gelisTarihi)}</Hucre>
            <Hucre>{a.gelisTarihi && a.durum !== "SATILDI" ? `${Math.floor((bugun - a.gelisTarihi.getTime()) / 86_400_000)} gün` : "-"}</Hucre>
            {maliyet && <Hucre>{tl(a.maliyetler.reduce((t, m) => t + Number(m.tutar), 0))}</Hucre>}
          </tr>
        ))}
      </Tablo>
    </>
  );
}
