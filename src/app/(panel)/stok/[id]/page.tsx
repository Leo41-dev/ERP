import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { STOK_HAREKET_AD, URUN_TUR_AD, miktar, tarihSaat, tl, yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { kritikDurum, fiyattanKarOrani } from "@/lib/stokHesap";
import { stokDuzelt } from "../eylem";
import { StokDuzeltFormu } from "./StokDuzeltFormu";

const DURUM = { eksi: ["kirmizi", "Eksi stok"], yok: ["gri", "Stokta yok"], kritik: ["sari", "Kritik seviyede"], normal: ["yesil", "Stokta"] } as const;

export default async function UrunKarti({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kayit?: string; tum?: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const p = await searchParams;
  const u = Number.isInteger(id) ? await db.urun.findUnique({ where: { id }, include: { grup: true, marka: true } }) : null;
  if (!u || u.tur === "ARAC") notFound();
  const maliyet = maliyetGorur(k);
  const yonetebilir = k.rol === "YONETICI" || k.rol === "DEPO" || k.rol === "MUHASEBE";
  const sinir = p.tum ? undefined : 50;
  const [hareketler, adet, satis90] = await Promise.all([
    db.stokHareketi.findMany({
      where: { urunId: id },
      orderBy: { id: "desc" },
      take: sinir,
      include: { satis: { select: { id: true, formNo: true, cari: { select: { unvan: true } } } }, stokGiris: { select: { id: true, girisNo: true, faturaNo: true, tedarikci: { select: { unvan: true } } } }, sayim: { select: { id: true, sayimNo: true } }, iade: { select: { iadeNo: true } } },
    }),
    db.stokHareketi.count({ where: { urunId: id } }),
    db.stokHareketi.aggregate({ where: { urunId: id, satisId: { not: null }, tur: { in: ["SATIS", "IADE", "IPTAL"] }, tarih: { gte: new Date(Date.now() - 90 * 86_400_000) } }, _sum: { miktar: true } }),
  ]);
  const m = Number(u.miktar);
  const d = u.tur === "HIZMET" ? null : DURUM[kritikDurum(m, u.kritikStok === null ? null : Number(u.kritikStok))];
  const aylikSatis = -Number(satis90._sum.miktar ?? 0) / 3;
  const marj = u.satisFiyati ? fiyattanKarOrani(Number(u.satisFiyati), u.ortMaliyet === null ? null : Number(u.ortMaliyet), Number(u.kdvOrani), Number(u.otvOrani)) : null;

  const belge = (h: (typeof hareketler)[number]) => {
    if (h.satis) return <Link href={`/satislar/${h.satis.id}`} className="hover:underline">Satış {h.satis.formNo}{h.iade ? ` · iade ${h.iade.iadeNo}` : ""} · {h.satis.cari.unvan}</Link>;
    if (h.stokGiris) return <Link href={`/stok/giris/${h.stokGiris.id}`} className="hover:underline">Giriş {h.stokGiris.girisNo}{h.stokGiris.faturaNo ? ` · fatura ${h.stokGiris.faturaNo}` : ""}{h.stokGiris.tedarikci ? ` · ${h.stokGiris.tedarikci.unvan}` : ""}</Link>;
    if (h.sayim) return <Link href={`/stok/sayim/${h.sayim.id}`} className="hover:underline">Sayım {h.sayim.sayimNo}</Link>;
    return h.aciklama ?? "-";
  };

  return (
    <>
      <SayfaBaslik
        baslik={u.ad}
        aciklama={<><span className="font-mono">{u.kod}</span> · {URUN_TUR_AD[u.tur]}{u.grup ? ` · ${u.grup.ad}` : ""}{u.marka ? ` · ${u.marka.ad}` : ""}{!u.aktif && " · pasif"}</>}
        sag={yonetebilir && <BaglantiButon href={`/stok/${u.id}/duzenle`}>Düzenle</BaglantiButon>}
      />
      {p.kayit && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Ürün kartı kaydedildi.</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Bilgi ad="Stoktaki miktar" deger={u.tur === "HIZMET" ? "Stok tutulmaz" : `${miktar(m)} ${u.birim}`} ek={d && <Etiket renk={d[0]}>{d[1]}</Etiket>} />
        <Bilgi
          ad="Satış fiyatı (vergiler dahil)"
          deger={tl(u.satisFiyati)}
          ek={<span className="text-xs text-zinc-500">KDV {yuzde(u.kdvOrani)}{Number(u.otvOrani) > 0 && ` · ÖTV ${yuzde(u.otvOrani)}`}{maliyet && u.fiyatTipi === "MARJ" && ` · kâr oranı ${yuzde(u.karOrani)}`}</span>}
        />
        {maliyet && <Bilgi ad="Ortalama maliyet (KDV hariç)" deger={tl(u.ortMaliyet)} ek={marj !== null && <span className="text-xs text-zinc-500">Maliyet üzerine kâr {yuzde(marj)}</span>} />}
        <Bilgi ad="Aylık ortalama satış" deger={`${miktar(Math.round(aylikSatis * 10) / 10)} ${u.birim}`} ek={<span className="text-xs text-zinc-500">son 90 gün</span>} />
      </div>
      <Kart baslik="Kart bilgileri" className="mb-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          <Satir ad="Barkod" deger={u.barkod ? <span className="font-mono">{u.barkod}</span> : "-"} />
          <Satir ad="Raf / yer" deger={u.raf ?? "-"} />
          <Satir ad="Kritik seviye" deger={u.kritikStok === null ? "-" : `${miktar(u.kritikStok)} ${u.birim}`} />
          {maliyet && <Satir ad="Liste alış fiyatı" deger={tl(u.alisFiyati)} />}
          {u.not && <Satir ad="Not" deger={u.not} />}
        </dl>
      </Kart>
      {yonetebilir && u.tur !== "HIZMET" && (
        <Kart baslik="Stok çıkışı / elle giriş" className="mb-4">
          <StokDuzeltFormu eylem={stokDuzelt.bind(null, u.id)} birim={u.birim} />
        </Kart>
      )}
      <h2 className="mb-2 mt-6 text-sm font-semibold">Stok hareketleri</h2>
      <Tablo basliklar={["Tarih", "İşlem", "Belge / açıklama", "Giriş", "Çıkış", "Kalan", ...(maliyet ? ["Birim maliyet"] : []), "Kaydeden"]} bos={!hareketler.length}>
        {hareketler.map((h) => {
          const x = Number(h.miktar);
          return (
            <tr key={h.id}>
              <Hucre>{tarihSaat(h.tarih)}</Hucre>
              <Hucre>{STOK_HAREKET_AD[h.tur]}</Hucre>
              <Hucre className="max-w-96 truncate">{belge(h)}</Hucre>
              <Hucre className="text-right tabular-nums">{x > 0 ? miktar(x) : ""}</Hucre>
              <Hucre className="text-right tabular-nums">{x < 0 ? miktar(-x) : ""}</Hucre>
              <Hucre className={`text-right tabular-nums ${Number(h.bakiye) < 0 ? "text-red-700" : ""}`}>{miktar(h.bakiye)}</Hucre>
              {maliyet && <Hucre className="text-right tabular-nums">{tl(h.birimMaliyet)}</Hucre>}
              <Hucre className="text-zinc-500">{h.kaydeden ?? ""}</Hucre>
            </tr>
          );
        })}
      </Tablo>
      {sinir && adet > sinir && <Link href={`/stok/${u.id}?tum=1`} className="mt-2 inline-block text-sm text-zinc-600 hover:underline">Tüm {adet} hareketi göster</Link>}
    </>
  );
}

function Bilgi({ ad, deger, ek }: { ad: string; deger: string; ek?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-500">{ad}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{deger}</p>
      {ek && <div className="mt-1">{ek}</div>}
    </div>
  );
}
function Satir({ ad, deger }: { ad: string; deger: React.ReactNode }) {
  return <div><dt className="text-xs text-zinc-500">{ad}</dt><dd>{deger}</dd></div>;
}
