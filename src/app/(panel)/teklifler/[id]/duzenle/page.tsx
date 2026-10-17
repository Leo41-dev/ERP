import { notFound, redirect } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { bugunTr } from "@/lib/dogrulama/teklif";
import { yetkiIste } from "@/lib/oturum";
import { teklifKaydet } from "../../eylem";
import { TeklifFormu } from "../../TeklifFormu";
import { baslangicYap, formVerisi } from "../../veri";

export default async function TeklifDuzenle({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? await db.teklif.findUnique({ where: { id }, include: { kalemler: true } }) : null;
  if (!t || (k.rol === "SATIS" && t.saticiId !== k.id)) notFound();
  if (t.durum !== "ACIK") redirect(`/teklifler/${id}`);
  const v = await formVerisi();
  const gecerlilik = t.gecerlilik.toISOString().slice(0, 10);
  return (
    <>
      <SayfaBaslik baslik={`Teklif ${t.teklifNo} düzenle`} />
      <TeklifFormu eylem={teklifKaydet.bind(null, t.id)} {...v} baslangic={baslangicYap(t, gecerlilik < bugunTr() ? v.gecerlilik : gecerlilik)} dugme="Değişiklikleri kaydet" />
    </>
  );
}
