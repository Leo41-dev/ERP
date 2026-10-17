import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { ODEME_AD, SATIS_DURUM_AD, SATIS_DURUM_RENK, tarih, tarihSaat, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { faturaIsle, satisIptal, teslimKontrolKaydet } from "../eylem";
import { FaturaFormu, IptalFormu, TeslimKontrolFormu } from "./Islemler";

export default async function SatisDetay({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const s = Number.isInteger(id)
    ? await db.satis.findUnique({
        where: { id },
        include: { cari: true, satici: true, kalemler: { include: { arac: { include: { maliyetler: true } } } }, tahsilatlar: { orderBy: { tarih: "asc" } }, teslimKontrol: true, teklif: { select: { id: true, teklifNo: true } } },
      })
    : null;
  if (!s || (k.rol === "SATIS" && s.saticiId !== k.id)) notFound();
  const [maddeler, belge] = await Promise.all([
    db.kontrolMaddesi.findMany({ where: { aktif: true }, orderBy: { sira: "asc" } }),
    belgeAyarlari(),
  ]);
  const yapilan = (s.teslimKontrol?.maddeler ?? []) as { ad: string; tamam: boolean }[];
  const tahsil = s.tahsilatlar.filter((x) => !x.iptalZamani).reduce((t, x) => t + Number(x.tutar), 0);
  const kalan = Math.round((Number(s.genelToplam) - tahsil) * 100) / 100;
  const maliyet = s.kalemler.reduce((t, x) => t + (x.arac?.maliyetler.reduce((a, m) => a + Number(m.tutar), 0) ?? 0), 0);
  const kayitli = s.durum === "KAYITLI";
  return (
    <>
      <SayfaBaslik
        baslik={`${s.tur === "HIZLI" ? "Hızlı satış" : "Satış"} ${s.formNo}`}
        aciklama={<>{tarihSaat(s.tarih)} · {s.satici?.adSoyad ?? "-"}{s.teklif && <> · <Link href={`/teklifler/${s.teklif.id}`} className="hover:underline">{s.teklif.teklifNo} numaralı tekliften</Link></>}</>}
        sag={
          <div className="flex items-center gap-2">
            <Etiket renk={SATIS_DURUM_RENK[s.durum]}>{SATIS_DURUM_AD[s.durum]}</Etiket>
            {s.tur === "HIZLI"
              ? <BaglantiButon href={`/yazdir/fis/${s.id}`} target="_blank">Fişi yazdır</BaglantiButon>
              : <BaglantiButon href={`/yazdir/satis/${s.id}`} target="_blank">Satış formu ve PDI yazdır</BaglantiButon>}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Kart baslik="Müşteri">
          <p className="text-sm font-medium"><Link href={`/musteriler/${s.cari.id}`} className="hover:underline">{s.cari.unvan}</Link></p>
          <p className="mt-1 text-sm text-zinc-600">{s.cari.tckn ?? s.cari.vkn ?? "-"} · {telefonGoster(s.cari.telefon)}</p>
          <p className="text-sm text-zinc-600">{[s.cari.acikAdres, [s.cari.ilce, s.cari.il].filter(Boolean).join("/")].filter(Boolean).join(" ")}</p>
        </Kart>
        <Kart baslik="Tutar">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Matrah</dt><dd>{tl(s.araToplam)}</dd>
            <dt className="text-zinc-500">ÖTV</dt><dd>{tl(s.otvToplam)}</dd>
            <dt className="text-zinc-500">KDV</dt><dd>{tl(s.kdvToplam)}</dd>
            <dt className="font-medium">Toplam (fatura)</dt><dd className="font-medium">{tl(s.genelToplam)}</dd>
            {maliyetGorur(k) && s.durum !== "IPTAL" && (<><dt className="text-zinc-500">Kâr</dt><dd>{tl(Number(s.genelToplam) - maliyet)}</dd></>)}
          </dl>
          {s.faturaNo && <p className="mt-2 text-xs text-zinc-500">Fatura {s.faturaNo} · {tarih(s.faturaTarihi)}</p>}
        </Kart>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Kalemler</h2>
      <Tablo basliklar={s.tur === "HIZLI" ? ["Açıklama", "Adet", "KDV", "Tutar"] : ["Açıklama", "Şase", "ÖTV", "KDV", "Tutar"]}>
        {s.kalemler.map((x) => (
          <tr key={x.id}>
            <Hucre>{x.aciklama}</Hucre>
            {s.tur === "HIZLI" ? (
              <Hucre>{Number(x.miktar).toLocaleString("tr-TR")}</Hucre>
            ) : (
              <>
                <Hucre>{x.arac ? <Link href={`/araclar/${x.arac.id}`} className="font-mono hover:underline">{x.arac.sase}</Link> : "-"}</Hucre>
                <Hucre>{yuzde(x.otvOrani)}</Hucre>
              </>
            )}
            <Hucre>{yuzde(x.kdvOrani)}</Hucre>
            <Hucre>{tl(x.tutar)}</Hucre>
          </tr>
        ))}
      </Tablo>

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Ödemeler · {tl(tahsil)} / {tl(s.genelToplam)}
          {s.durum !== "IPTAL" && kalan >= 0.01 && <span className="ml-2 text-amber-700">kalan {tl(kalan)}</span>}
        </h2>
        {s.durum !== "IPTAL" && k.rol !== "DEPO" && <Link href={`/tahsilat/yeni?satis=${s.id}`} className="text-sm text-zinc-600 hover:underline">Tahsilat ekle</Link>}
      </div>
      <Tablo basliklar={["Tarih", "Yöntem", "Tutar", "Taksit / vade", "Açıklama", "Kaydeden", ""]} bos={!s.tahsilatlar.length}>
        {s.tahsilatlar.map((t) => (
          <tr key={t.id} className={t.iptalZamani ? "text-zinc-400 line-through" : ""}>
            <Hucre>{tarih(t.tarih)}</Hucre><Hucre>{ODEME_AD[t.yontem]}</Hucre><Hucre>{tl(t.tutar)}</Hucre>
            <Hucre>{t.taksit ? `${t.taksit} taksit` : t.vade ? `vade ${tarih(t.vade)}` : "-"}</Hucre><Hucre>{t.aciklama ?? "-"}</Hucre><Hucre>{t.kaydeden ?? "-"}</Hucre>
            <Hucre>{t.iptalZamani ? <span className="text-xs">İptal: {t.iptalNedeni}</span> : <Link href={`/yazdir/makbuz?id=${t.id}`} target="_blank" className="text-xs text-zinc-600 hover:underline">Makbuz</Link>}</Hucre>
          </tr>
        ))}
      </Tablo>

      {(s.aksesuarlar || s.hizmetler || s.not || s.teslimTarihi) && (
        <Kart baslik="Teslim ve notlar" className="mt-6">
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Teslim tarihi</dt><dd>{tarih(s.teslimTarihi)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Aksesuarlar</dt><dd>{s.aksesuarlar ?? "-"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Hizmetler</dt><dd>{s.hizmetler ?? "-"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Not</dt><dd className="whitespace-pre-line">{s.not ?? "-"}</dd></div>
          </dl>
        </Kart>
      )}

      {s.durum !== "IPTAL" && s.tur === "ARAC" && (
        <Kart baslik="Araç teslim ve son kontrol listesi (PDI)" className="mt-6" sag={s.teslimKontrol && <span className="text-xs text-zinc-500">{tarihSaat(s.teslimKontrol.tarih)}</span>}>
          <TeslimKontrolFormu
            eylem={teslimKontrolKaydet.bind(null, s.id)}
            kontrolEden={s.teslimKontrol?.kontrolEden ?? belge["belge.kontrolEden"]}
            maddeler={maddeler.map((m) => ({ id: m.id, ad: m.ad, tamam: yapilan.some((y) => y.ad === m.ad && y.tamam) }))}
          />
        </Kart>
      )}

      {kayitli && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(k.rol === "YONETICI" || k.rol === "MUHASEBE") && <Kart baslik="Fatura"><FaturaFormu eylem={faturaIsle.bind(null, s.id)} /></Kart>}
          {(k.rol === "YONETICI" || k.rol === "SATIS") && <Kart baslik="İptal"><IptalFormu eylem={satisIptal.bind(null, s.id)} /></Kart>}
        </div>
      )}
      {s.durum === "IPTAL" && (
        <Kart baslik="İptal" className="mt-6"><p className="text-sm">{s.iptalNedeni} · {s.iptalEden} · {tarihSaat(s.iptalZamani)}</p></Kart>
      )}
    </>
  );
}
