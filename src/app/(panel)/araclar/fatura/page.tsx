import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { FaturaYukle } from "./FaturaYukle";

export default async function FaturaIleGiris() {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const [modeller, konumlar, tipler] = await Promise.all([
    db.aracModeli.findMany({ include: { marka: true, tip: true }, orderBy: [{ marka: { ad: "asc" } }, { model: "asc" }, { altModel: "asc" }] }),
    db.konum.findMany({ where: { aktif: true }, orderBy: { ad: "asc" } }),
    db.aracTipi.findMany({ orderBy: { ad: "asc" } }),
  ]);
  return (
    <>
      <SayfaBaslik
        baslik="Fatura ile araç girişi"
        aciklama="Tedarikçi e-Fatura XML dosyalarını seçin. Araçlar faturadan okunur, modelleri eşleştirilir; onayladığınızda stoğa alınır. Stokta olan şase tekrar girilmez."
      />
      <FaturaYukle
        modeller={modeller.map((m) => ({ id: m.id, marka: m.marka.ad, model: m.model, alt: m.altModel, tip: m.tip?.ad ?? "" }))}
        konumlar={konumlar.map((x) => ({ id: x.id, ad: x.ad }))}
        tipler={tipler.map((x) => ({ id: x.id, ad: x.ad }))}
        maliyetGorur={maliyetGorur(k)}
      />
    </>
  );
}
