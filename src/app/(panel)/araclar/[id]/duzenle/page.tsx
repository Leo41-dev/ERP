import { notFound } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { AracFormu, type AracVarsayilan } from "../../AracFormu";
import { aracKaydet } from "../../eylem";
import { aracFormListeleri } from "../../veri";

const gun = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

export default async function AracDuzenle({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await db.arac.findUnique({ where: { id }, include: { maliyetler: true } }) : null;
  if (!a) notFound();
  const v: AracVarsayilan = {
    sase: a.sase, motorNo: str(a.motorNo), modelId: str(a.modelId), yil: str(a.yil), renk: str(a.renk), euroStandart: str(a.euroStandart),
    kondisyon: a.kondisyon, konumId: str(a.konumId), gelisTarihi: gun(a.gelisTarihi), tedarikciId: str(a.tedarikciId),
    alisFaturaNo: str(a.alisFaturaNo), alisSekli: str(a.alisSekli), kdvOrani: str(a.kdvOrani?.toNumber()), otvOrani: str(a.otvOrani?.toNumber()),
    tescilDurum: a.tescilDurum, plaka: str(a.plaka), ruhsatSeriNo: str(a.ruhsatSeriNo), tescilTarihi: gun(a.tescilTarihi), not: str(a.not),
    ...Object.fromEntries(a.maliyetler.map((m) => [`maliyet_${m.tur}`, String(m.tutar)])),
  };
  return (
    <>
      <SayfaBaslik baslik={`${a.sase} düzenle`} />
      <AracFormu eylem={aracKaydet.bind(null, id)} listeler={await aracFormListeleri()} v={v} maliyetGoster={maliyetGorur(k)} />
    </>
  );
}
