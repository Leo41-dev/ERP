import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { SatisFormu } from "../SatisFormu";

export default async function YeniSatis({ searchParams }: { searchParams: Promise<{ arac?: string }> }) {
  await yetkiIste("SATIS");
  const secili = Number((await searchParams).arac) || undefined;
  const [araclar, otvOranlari] = await Promise.all([
    db.arac.findMany({ where: { durum: "STOKTA" }, include: { model: { include: { marka: true, tip: true } }, konum: true }, orderBy: { sase: "asc" } }),
    db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } }),
  ]);
  return (
    <>
      <SayfaBaslik baslik="Yeni satış" aciklama="Satış kaydedilince araç rezerve olur; fatura kesilince satıldıya geçer." />
      <SatisFormu
        secili={secili}
        otvOranlari={otvOranlari.map((o) => Number(o.oran))}
        araclar={araclar.map((a) => ({
          id: a.id,
          etiket: [a.sase, a.model ? `${a.model.marka.ad} ${a.model.altModel || a.model.model}` : null, a.renk, a.yil, a.konum?.ad].filter(Boolean).join(" · "),
          kdv: a.kdvOrani ? Number(a.kdvOrani) : null,
          otv: a.otvOrani !== null ? Number(a.otvOrani) : a.model?.tip?.varsayilanOtvOrani ? Number(a.model.tip.varsayilanOtvOrani) : null,
        }))}
      />
    </>
  );
}
