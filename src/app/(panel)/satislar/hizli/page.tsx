import Link from "next/link";
import { BaglantiButon, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { ODEME_AD, tarihSaat, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { HizliSatisFormu } from "./HizliSatisFormu";

export default async function HizliSatis({ searchParams }: { searchParams: Promise<{ kayit?: string; teklif?: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const p = await searchParams;
  const kayitId = Number(p.kayit) || null;
  const teklifId = Number(p.teklif) || null;
  // Türkiye saatiyle bugünün başı (UTC+3, yaz saati yok)
  const gunBasi = new Date(Math.floor((Date.now() + 3 * 3_600_000) / 86_400_000) * 86_400_000 - 3 * 3_600_000);
  const [firmalar, kayit, bugun, t] = await Promise.all([
    db.firma.findMany({ where: { aktif: true }, orderBy: { id: "asc" }, select: { id: true, unvan: true, varsayilan: true } }),
    kayitId ? db.satis.findFirst({ where: { id: kayitId, tur: "HIZLI", ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) } }) : null,
    db.satis.findMany({
      where: { tur: "HIZLI", tarih: { gte: gunBasi }, ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) },
      orderBy: { tarih: "desc" },
      include: { kalemler: { select: { aciklama: true } }, tahsilatlar: { select: { yontem: true } } },
    }),
    teklifId && !kayitId
      ? db.teklif.findFirst({ where: { id: teklifId, durum: "ACIK", ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) }, include: { kalemler: { orderBy: { sira: "asc" } } } })
      : null,
  ]);
  const virgul = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 3, useGrouping: false });
  const teklif = t
    ? {
        id: t.id,
        no: t.teklifNo,
        unvan: t.musteriAd,
        telefon: t.telefon ?? "",
        kimlikNo: t.kimlikNo ?? "",
        kalemler: t.kalemler.map((x) => ({ aciklama: x.aciklama, miktar: virgul(Number(x.miktar)), fiyat: virgul(Number(x.birimFiyat)), kdv: String(Number(x.kdvOrani)) })),
      }
    : undefined;
  const gunToplam = bugun.filter((s) => s.durum !== "IPTAL").reduce((t, s) => t + Number(s.genelToplam), 0);

  return (
    <>
      <SayfaBaslik baslik="Hızlı satış" aciklama="Araç dışı satışlar: parça, aksesuar, ekipman, hizmet. Kaydettikten sonra fişi yazdırın." />
      {kayit && (
        <Kart className="mb-4 border-green-300 bg-green-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-green-800">Satış {kayit.formNo} kaydedildi · {tl(kayit.genelToplam)}</p>
            <div className="flex gap-2">
              <BaglantiButon href={`/yazdir/fis/${kayit.id}`} target="_blank">Fişi yazdır</BaglantiButon>
              <Link href={`/satislar/${kayit.id}`} className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm">Satışı aç</Link>
            </div>
          </div>
        </Kart>
      )}
      <HizliSatisFormu key={kayitId ?? teklifId ?? "yeni"} teklif={teklif} firmalar={firmalar} />

      <h2 className="mb-2 mt-8 text-sm font-semibold">Bugünkü hızlı satışlar · {tl(gunToplam)}</h2>
      <Tablo basliklar={["No", "Saat", "Kalemler", "Ödeme", "Tutar", ""]} bos={!bugun.length}>
        {bugun.map((s) => (
          <tr key={s.id} className={s.durum === "IPTAL" ? "text-zinc-400 line-through" : ""}>
            <Hucre><Link href={`/satislar/${s.id}`} className="hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarihSaat(s.tarih).split(" ").pop()}</Hucre>
            <Hucre className="max-w-80 truncate">{s.kalemler.map((x) => x.aciklama).join(", ")}</Hucre>
            <Hucre>{[...new Set(s.tahsilatlar.map((t) => ODEME_AD[t.yontem]))].join(", ")}</Hucre>
            <Hucre>{tl(s.genelToplam)}</Hucre>
            <Hucre><Link href={`/yazdir/fis/${s.id}`} target="_blank" className="text-xs text-zinc-600 hover:underline">Fiş</Link></Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
