import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { SatisFormu } from "../SatisFormu";
import { kdvOranlari } from "@/lib/vergi";

export default async function YeniSatis({ searchParams }: { searchParams: Promise<{ arac?: string; teklif?: string }> }) {
  const k = await yetkiIste("SATIS");
  const p = await searchParams;
  const secili = Number(p.arac) || undefined;
  const teklifId = Number(p.teklif) || null;
  const [araclar, otvOranlari, t] = await Promise.all([
    db.arac.findMany({ where: { durum: "STOKTA" }, include: { model: { include: { marka: true, tip: true } }, konum: true }, orderBy: { sase: "asc" } }),
    db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } }),
    teklifId
      ? db.teklif.findFirst({ where: { id: teklifId, durum: "ACIK", ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) }, include: { kalemler: { orderBy: { sira: "asc" }, include: { model: { include: { marka: true } } } } } })
      : null,
  ]);
  // tekliften gelindiyse araç satırı forma aktarılır; diğer kalemler aksesuar/hizmet notuna yazılır
  const aracSatiri = t?.kalemler.find((x) => x.modelId);
  const teklif = t && aracSatiri
    ? {
        id: t.id,
        no: t.teklifNo,
        modelId: aracSatiri.modelId!,
        modelAd: aracSatiri.aciklama,
        musteri: { unvan: t.musteriAd, telefon: t.telefon ?? "", eposta: t.eposta ?? "", kimlikNo: t.kimlikNo ?? "" },
        tutar: String(Number(aracSatiri.birimFiyat)).replace(".", ","),
        kdv: String(Number(aracSatiri.kdvOrani)),
        otv: String(Number(aracSatiri.otvOrani)),
        digerler: t.kalemler.filter((x) => x !== aracSatiri).map((x) => `${x.aciklama}${Number(x.miktar) !== 1 ? ` x${Number(x.miktar).toLocaleString("tr-TR")}` : ""}`).join(", "),
        digerTutar: t.kalemler.filter((x) => x !== aracSatiri).reduce((a, x) => a + Number(x.tutar), 0),
        toplam: Number(t.genelToplam),
        not: [t.odemeKosullari && `Ödeme koşulları: ${t.odemeKosullari}`, t.not].filter(Boolean).join("\n"),
      }
    : undefined;
  return (
    <>
      <SayfaBaslik baslik="Yeni satış" aciklama={teklif ? `${teklif.no} numaralı tekliften` : "Satış kaydedilince araç rezerve olur; fatura kesilince satıldıya geçer."} />
      <SatisFormu
        secili={secili}
        teklif={teklif}
        otvOranlari={otvOranlari.map((o) => Number(o.oran))}
        kdvOranlari={await kdvOranlari(db)}
        araclar={araclar.map((a) => ({
          id: a.id,
          modelId: a.modelId,
          etiket: [a.sase, a.model ? `${a.model.marka.ad} ${a.model.altModel || a.model.model}` : null, a.renk, a.yil, a.konum?.ad].filter(Boolean).join(" · "),
          kdv: a.kdvOrani ? Number(a.kdvOrani) : null,
          otv: a.otvOrani !== null ? Number(a.otvOrani) : a.model?.tip?.varsayilanOtvOrani ? Number(a.model.tip.varsayilanOtvOrani) : null,
        }))}
      />
    </>
  );
}
