import { SayfaBaslik } from "@/components/ui";
import { yetkiIste } from "@/lib/oturum";
import { CariFormu } from "../CariFormu";
import { cariKaydet } from "../eylem";

export default async function YeniMusteri() {
  await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  return (
    <>
      <SayfaBaslik baslik="Yeni müşteri" />
      <CariFormu eylem={cariKaydet.bind(null, null)} />
    </>
  );
}
