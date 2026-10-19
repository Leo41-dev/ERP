import { SayfaBaslik } from "@/components/ui";
import { yetkiIste } from "@/lib/oturum";
import { kullaniciKaydet } from "../../eylem";
import { KullaniciFormu } from "../KullaniciFormu";

export default async function YeniKullanici() {
  await yetkiIste("YONETICI");
  return (
    <>
      <SayfaBaslik baslik="Yeni kullanıcı" />
      <KullaniciFormu eylem={kullaniciKaydet.bind(null, null)} />
    </>
  );
}
