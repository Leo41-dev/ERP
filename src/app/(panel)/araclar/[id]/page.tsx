import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Buton, Etiket, Hucre, Kart, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { ARAC_DURUM_AD, KONDISYON_AD, SATIS_DURUM_AD, TESCIL_AD, tarih, tarihSaat, tl, yuzde } from "@/lib/bicim";
import { MALIYET_TURLERI } from "@/lib/dogrulama/arac";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { konumDegistir } from "../eylem";

const MALIYET_AD = Object.fromEntries(MALIYET_TURLERI);

export default async function AracDetay({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const a = Number.isInteger(id)
    ? await db.arac.findUnique({
        where: { id },
        include: {
          model: { include: { marka: true, tip: true } },
          konum: true,
          tedarikci: true,
          maliyetler: true,
          transferler: { orderBy: { tarih: "desc" }, include: { eskiKonum: true, yeniKonum: true } },
          kalemler: { include: { satis: { include: { cari: true } } } },
          garanti: true,
        },
      })
    : null;
  if (!a) notFound();
  const konumlar = await db.konum.findMany({ where: { aktif: true }, orderBy: { ad: "asc" } });
  const maliyet = maliyetGorur(k);
  const toplamMaliyet = a.maliyetler.reduce((t, m) => t + Number(m.tutar), 0);
  const bilgi: [string, string][] = [
    ["Marka / model", a.model ? `${a.model.marka.ad} ${[a.model.model, a.model.altModel].filter(Boolean).join(" ")}` : "-"],
    ["Tip", a.model?.tip?.ad ?? "-"],
    ["Model yılı / renk", `${a.yil ?? "-"} / ${a.renk ?? "-"}`],
    ["Motor no", a.motorNo ?? "-"],
    ["Kondisyon", KONDISYON_AD[a.kondisyon]],
    ["Geliş tarihi", tarih(a.gelisTarihi)],
    ["Tedarikçi", a.tedarikci?.unvan ?? "-"],
    ["Alış fatura no", a.alisFaturaNo ?? "-"],
    ["KDV / ÖTV", `${yuzde(a.kdvOrani)} / ${yuzde(a.otvOrani)}`],
    ["Tescil", `${TESCIL_AD[a.tescilDurum]}${a.plaka ? ` · ${a.plaka}` : ""}`],
    ["Garanti", a.garanti ? `${tarih(a.garanti.baslangic)} – ${tarih(a.garanti.bitis)}` : "-"],
  ];
  return (
    <>
      <SayfaBaslik
        baslik={a.sase}
        aciklama={`${ARAC_DURUM_AD[a.durum]} · ${a.konum?.ad ?? "konum yok"}`}
        sag={
          <div className="flex gap-2">
            {a.durum === "STOKTA" && <BaglantiButon href={`/satislar/yeni?arac=${a.id}`}>Satış yap</BaglantiButon>}
            {k.rol !== "SATIS" && <BaglantiButon href={`/araclar/${a.id}/duzenle`} className="bg-zinc-600">Düzenle</BaglantiButon>}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Kart baslik="Bilgiler" className="md:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
            {bilgi.map(([x, y]) => <div key={x}><dt className="text-xs text-zinc-500">{x}</dt><dd>{y}</dd></div>)}
          </dl>
          {a.not && <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">{a.not}</p>}
        </Kart>
        <Kart baslik="Konum">
          <form action={konumDegistir.bind(null, a.id)} className="flex gap-2">
            <Secim name="konumId" defaultValue={a.konumId ?? ""}>
              {konumlar.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
            </Secim>
            <Buton tur="ikincil">Taşı</Buton>
          </form>
          <ul className="mt-3 space-y-1 text-xs text-zinc-600">
            {a.transferler.map((t) => (
              <li key={t.id}>{tarihSaat(t.tarih)} · {t.eskiKonum?.ad ?? "-"} → {t.yeniKonum.ad}{t.yapan ? ` · ${t.yapan}` : ""}</li>
            ))}
          </ul>
        </Kart>
      </div>
      {maliyet && (
        <Kart baslik="Maliyet" className="mt-4" sag={<span className="text-sm font-semibold">{tl(toplamMaliyet)}</span>}>
          <dl className="grid gap-3 text-sm md:grid-cols-4">
            {a.maliyetler.map((m) => <div key={m.id}><dt className="text-xs text-zinc-500">{MALIYET_AD[m.tur]}</dt><dd>{tl(m.tutar)}</dd></div>)}
          </dl>
          {!a.maliyetler.length && <p className="text-sm text-zinc-500">Maliyet girilmemiş.</p>}
        </Kart>
      )}
      <h2 className="mb-2 mt-6 text-sm font-semibold">Satış geçmişi</h2>
      <Tablo basliklar={["Form no", "Tarih", "Müşteri", "Tutar", "Durum", ...(maliyet ? ["Kâr"] : [])]} bos={!a.kalemler.length}>
        {a.kalemler.map(({ satis: s, tutar }) => (
          <tr key={s.id}>
            <Hucre><Link href={`/satislar/${s.id}`} className="font-medium hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarih(s.tarih)}</Hucre>
            <Hucre>{s.cari.unvan}</Hucre>
            <Hucre>{tl(tutar)}</Hucre>
            <Hucre><Etiket renk={s.durum === "IPTAL" ? "kirmizi" : "gri"}>{SATIS_DURUM_AD[s.durum]}</Etiket></Hucre>
            {maliyet && <Hucre>{s.durum === "IPTAL" ? "-" : tl(Number(tutar) - toplamMaliyet)}</Hucre>}
          </tr>
        ))}
      </Tablo>
    </>
  );
}
