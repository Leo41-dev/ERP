import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { teklifKaydet } from "../eylem";
import { TeklifFormu } from "../TeklifFormu";
import { baslangicYap, formVerisi } from "../veri";

export default async function YeniTeklif({ searchParams }: { searchParams: Promise<{ kopya?: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const kopyaId = Number((await searchParams).kopya) || null;
  const [v, kopya] = await Promise.all([
    formVerisi(),
    kopyaId ? db.teklif.findFirst({ where: { id: kopyaId, ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) }, include: { kalemler: true } }) : null,
  ]);
  return (
    <>
      <SayfaBaslik baslik={kopya ? `Yeni teklif (${kopya.teklifNo} numaralı tekliften kopya)` : "Yeni teklif"} aciklama="Fiyatlar vergiler dahil yazılır; ÖTV ve KDV kırılımı tutardan hesaplanır." />
      <TeklifFormu eylem={teklifKaydet.bind(null, null)} {...v} baslangic={baslangicYap(kopya, v.gecerlilik)} dugme="Teklifi kaydet" />
    </>
  );
}
