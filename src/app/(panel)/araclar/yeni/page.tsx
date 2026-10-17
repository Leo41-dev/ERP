import { SayfaBaslik } from "@/components/ui";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { AracFormu } from "../AracFormu";
import { aracKaydet } from "../eylem";
import { aracFormListeleri } from "../veri";

export default async function YeniArac() {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  return (
    <>
      <SayfaBaslik baslik="Araç girişi" />
      <AracFormu eylem={aracKaydet.bind(null, null)} listeler={await aracFormListeleri()} maliyetGoster={maliyetGorur(k)} />
    </>
  );
}
