import Link from "next/link";
import { notFound } from "next/navigation";
import { SilButonu } from "@/components/SilButonu";
import { BaglantiButon, Girdi, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { HESAP_TUR_AD, hesapDokumu } from "@/lib/finans";
import { yetkiIste } from "@/lib/oturum";
import { hesapKaydet } from "../eylem";
import { HareketIptalButonu, HesapFormu } from "../Formlar";

const KAYNAK_AD = { MANUEL: "Elle", TAHSILAT: "Tahsilat", GERI_ODEME: "İade ödemesi", VIRMAN: "Virman", ENTEGRASYON: "Banka entegrasyonu" } as const;
const gunAl = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export default async function HesapKarti({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bas?: string; bit?: string; kayit?: string }> }) {
  await yetkiIste("MUHASEBE");
  const id = Number((await params).id);
  const p = await searchParams;
  const bugun = new Date().toISOString().slice(0, 10);
  const bas = gunAl(p.bas) ?? `${bugun.slice(0, 7)}-01`;
  const bit = gunAl(p.bit) ?? bugun;
  const d = Number.isInteger(id) ? await hesapDokumu(id, new Date(`${bas}T00:00:00+03:00`), new Date(new Date(`${bit}T00:00:00+03:00`).getTime() + 86_400_000)) : null;
  if (!d) notFound();
  const h = d.hesap;
  const firmalar = await db.firma.findMany({ where: { aktif: true }, select: { id: true, unvan: true }, orderBy: { id: "asc" } });
  const gecerli = d.satirlar.filter((x) => !x.iptalZamani);
  return (
    <>
      <SayfaBaslik
        baslik={h.ad}
        aciklama={`${HESAP_TUR_AD[h.tur]}${h.banka ? ` · ${h.banka}` : ""}${h.iban ? ` · ${h.iban}` : ""}${h.aktif ? "" : " · pasif"}`}
        sag={
          <div className="flex gap-2">
            <SilButonu tur="finansHesabi" id={h.id} ad={h.ad} />
            {h.aktif && <BaglantiButon href={`/finans/hareket?hesap=${h.id}`}>Hareket gir</BaglantiButon>}
          </div>
        }
      />
      {p.kayit && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Hareket kaydedildi.</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kart><p className="text-xs text-zinc-500">Devreden ({tarih(new Date(`${bas}T12:00:00Z`))})</p><p className="mt-1 text-lg font-semibold tabular-nums">{tl(d.devreden)}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Giriş</p><p className="mt-1 text-lg font-semibold tabular-nums text-green-700">{tl(gecerli.reduce((a, x) => a + x.giris, 0))}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Çıkış</p><p className="mt-1 text-lg font-semibold tabular-nums text-red-700">{tl(gecerli.reduce((a, x) => a + x.cikis, 0))}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Bakiye ({tarih(new Date(`${bit}T12:00:00Z`))})</p><p className="mt-1 text-lg font-semibold tabular-nums">{tl(d.kapanis)}</p></Kart>
      </div>
      <form className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-500">Başlangıç<Girdi type="date" name="bas" defaultValue={bas} /></label>
        <label className="text-xs text-zinc-500">Bitiş<Girdi type="date" name="bit" defaultValue={bit} /></label>
        <button className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50">Göster</button>
      </form>
      <Tablo basliklar={["Tarih", "Açıklama", "Kategori / cari", "Kaynak", "Giriş", "Çıkış", "Bakiye", ""]} bos={!d.satirlar.length}>
        {d.satirlar.map((x) => {
          const satisId = x.tahsilat?.satisId ?? x.geriOdeme?.iade.satisId;
          return (
            <tr key={x.id} className={x.iptalZamani ? "text-zinc-400 line-through" : ""}>
              <Hucre>{tarih(x.tarih)}</Hucre>
              <Hucre>
                {satisId ? <Link href={`/satislar/${satisId}`} className="hover:underline">{x.aciklama}</Link> : x.aciklama}
                {x.belgeNo && <span className="ml-1 text-xs text-zinc-500">({x.belgeNo})</span>}
                {x.iptalZamani && <span className="ml-1 text-xs no-underline">iptal: {x.iptalNedeni}</span>}
              </Hucre>
              <Hucre>{[x.kategori?.ad, x.cari && <Link key="c" href={`/musteriler/${x.cari.id}`} className="hover:underline">{x.cari.unvan}</Link>].filter(Boolean).reduce<React.ReactNode[]>((a, y, i) => (i ? [...a, " · ", y] : [y]), [])}</Hucre>
              <Hucre className="text-xs text-zinc-500">{KAYNAK_AD[x.kaynak]}</Hucre>
              <Hucre className="text-right tabular-nums">{x.giris ? tl(x.giris) : ""}</Hucre>
              <Hucre className="text-right tabular-nums">{x.cikis ? tl(x.cikis) : ""}</Hucre>
              <Hucre className="text-right tabular-nums">{x.iptalZamani ? "" : tl(x.bakiye)}</Hucre>
              <Hucre>{!x.iptalZamani && (x.kaynak === "MANUEL" || x.kaynak === "VIRMAN") && <HareketIptalButonu id={x.id} />}</Hucre>
            </tr>
          );
        })}
      </Tablo>
      <Kart baslik="Hesap bilgileri" className="mt-6">
        <HesapFormu
          eylem={hesapKaydet.bind(null, h.id)}
          firmalar={firmalar}
          bugun={bugun}
          hesap={{ ...h, acilisBakiye: Number(h.acilisBakiye), acilisTarihi: h.acilisTarihi.toISOString().slice(0, 10) }}
        />
      </Kart>
    </>
  );
}
